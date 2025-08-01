#!/usr/bin/env node

import express from 'express';
import fs from 'fs';
import yaml from 'js-yaml';
import { OAuth2Auth } from '../dist/auth/oauth2.js';
import { SecureCredentialStore } from '../dist/auth/store.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Clean up any existing tokens first
console.log('🧹 Cleaning up any existing OAuth2 tokens...');
try {
  const tokensPath = '.pb.tokens';
  if (fs.existsSync(tokensPath)) {
    fs.unlinkSync(tokensPath);
    console.log('✅ Removed existing token file');
  }
} catch (error) {
  console.log('ℹ️  No existing tokens to clean up');
}

// Load OAuth2 scope configuration from YAML
function loadOAuth2Config() {
  try {
    const configPath = 'oauth2-config.yml';
    const yamlConfig = yaml.load(fs.readFileSync(configPath, 'utf8'));
    
    // Determine which scopes to use
    let scopes = [];
    
    // Priority: 1. Direct env var, 2. Preset, 3. Default preset
    if (process.env.PRODUCTBOARD_OAUTH_SCOPES) {
      scopes = process.env.PRODUCTBOARD_OAUTH_SCOPES.split(' ');
      console.log('📝 Using scopes from PRODUCTBOARD_OAUTH_SCOPES environment variable');
    } else {
      const preset = process.env.PRODUCTBOARD_OAUTH_PRESET || yamlConfig.defaults?.preset || 'reader';
      scopes = yamlConfig.oauth2.presets[preset];
      
      if (!scopes) {
        console.error(`❌ Unknown preset: ${preset}`);
        console.log('Available presets:', Object.keys(yamlConfig.oauth2.presets).join(', '));
        process.exit(1);
      }
      
      console.log(`📋 Using preset: ${preset}`);
    }
    
    return {
      scopes: scopes.join(' '),
      scopeList: scopes,
      yamlConfig
    };
  } catch (error) {
    console.error('❌ Failed to load oauth2-config.yml:', error.message);
    console.log('💡 Using fallback: users:read');
    return {
      scopes: 'users:read',
      scopeList: ['users:read'],
      yamlConfig: null
    };
  }
}

const { scopes, scopeList, yamlConfig } = loadOAuth2Config();

const app = express();
const port = 3000;

const oauth2Config = {
  clientId: process.env.PRODUCTBOARD_OAUTH_CLIENT_ID,
  clientSecret: process.env.PRODUCTBOARD_OAUTH_CLIENT_SECRET,
  authorizationEndpoint: 'https://app.productboard.com/oauth2/authorize',
  tokenEndpoint: 'https://app.productboard.com/oauth2/token',
  redirectUri: process.env.PRODUCTBOARD_OAUTH_REDIRECT_URI || 'http://localhost:3000/callback',
  scope: scopes
};

if (!oauth2Config.clientId || !oauth2Config.clientSecret) {
  console.error('❌ Missing OAuth2 credentials in .env file');
  console.error('Required: PRODUCTBOARD_OAUTH_CLIENT_ID and PRODUCTBOARD_OAUTH_CLIENT_SECRET');
  process.exit(1);
}

console.log('🔧 OAuth2 Configuration:');
console.log(`   Client ID: ${oauth2Config.clientId}`);
console.log(`   Redirect URI: ${oauth2Config.redirectUri}`);
console.log(`   Scopes (${scopeList.length}): ${oauth2Config.scope}`);

// Show scope details if available
if (yamlConfig && yamlConfig.oauth2.available_scopes) {
  console.log('\n📋 Scope Details:');
  scopeList.forEach(scope => {
    const description = yamlConfig.oauth2.available_scopes[scope];
    if (description) {
      console.log(`   • ${scope}: ${description}`);
    } else {
      console.log(`   • ${scope}: (custom scope)`);
    }
  });
}

console.log('');

const oauth2Auth = new OAuth2Auth(oauth2Config);
const store = new SecureCredentialStore();

// Step 1: Start authorization
app.get('/start', (req, res) => {
  const authUrl = oauth2Auth.getAuthorizationUrl();
  console.log(`\n🔐 Authorization URL generated:`);
  console.log(`${authUrl}\n`);
  
  res.send(`
    <h2>Productboard OAuth2 Setup</h2>
    <p>Click the link below to authorize the application:</p>
    <a href="${authUrl}" target="_blank">Authorize Application</a>
    <br><br>
    <p>After authorization, you'll be redirected back to this server.</p>
  `);
});

// Step 2: Handle callback
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    res.status(400).send('❌ Authorization failed: No code received');
    return;
  }
  
  if (!oauth2Auth.validateState(state)) {
    res.status(400).send('❌ Authorization failed: Invalid state parameter');
    return;
  }
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    const tokenResponse = await oauth2Auth.exchangeCodeForToken(code);
    
    // Store tokens
    store.updateAccessToken(tokenResponse.access_token, tokenResponse.expires_in);
    if (tokenResponse.refresh_token) {
      store.updateRefreshToken(tokenResponse.refresh_token);
    }
    
    console.log('✅ OAuth2 setup completed successfully!');
    console.log('📋 Token Details:');
    console.log(`   Access Token: ${tokenResponse.access_token.substring(0, 20)}...`);
    console.log(`   Expires In: ${tokenResponse.expires_in} seconds`);
    console.log(`   Refresh Token: ${tokenResponse.refresh_token ? tokenResponse.refresh_token.substring(0, 20) + '...' : 'Not provided'}`);
    
    // Save tokens to a file for the main application to use
    const tokenData = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync('.pb.tokens', JSON.stringify(tokenData, null, 2));
    console.log('💾 Tokens saved to .pb.tokens file');
    
    res.send(`
      <h2>✅ OAuth2 Setup Complete!</h2>
      <p>Tokens have been saved successfully. You can now start the MCP server.</p>
      <p>Run: <code>npm start</code></p>
      <br>
      <p>You can close this browser window.</p>
    `);
    
    // Shutdown server after 5 seconds
    setTimeout(() => {
      console.log('\n🛑 Shutting down OAuth2 setup server...');
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Token exchange failed:', error.message);
    res.status(500).send(`❌ Token exchange failed: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`\n🚀 OAuth2 Setup Server running at http://localhost:${port}`);
  console.log(`📝 Visit http://localhost:${port}/start to begin OAuth2 setup\n`);
});