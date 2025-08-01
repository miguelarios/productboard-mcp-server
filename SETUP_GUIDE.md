# Quick Setup Guide for Coworkers

This guide helps you set up the Productboard MCP server with your own OAuth2 credentials.

## Prerequisites

- Node.js 18+ installed
- Productboard Pro plan or higher (for API access)
- Admin access in your Productboard workspace

## Step 1: Create OAuth2 Application

1. **Go to Productboard OAuth2 Applications**
   - Visit: `https://app.productboard.com/oauth2/applications`
   - Click "Create application"

2. **Configure Application**
   - **Name**: `My MCP Server` (or any name you prefer)
   - **Redirect URI**: `http://localhost:3000/callback`
   - **Scopes**: Choose based on your role (see below)

3. **Choose Your Scopes Based on Your Productboard Role**
   
   https://developer.productboard.com/docs/how-to-integrate-with-productboard-via-oauth2-developer-documentation#access-scopes
   
   **For Contributors (most users):**
   ```
   notes:create, users:read, users_pii:read, members_pii:read
   ```
   
   **For Makers:**
   ```
   notes:create, users:read, users_pii:read, members_pii:read, users:manage, releases:create, feedback_forms:create
   ```
   
   **For Admins:**
   ```
   product_hierarchy_data:read, product_hierarchy_data:create, product_hierarchy_data:manage, custom_fields:read, releases:read, releases:create, releases:manage, notes:create, users:read, users:manage, users_pii:read, members_pii:read, plugin_integrations:manage, objectives:read, objectives:create, objectives:manage, key_results:read, key_results:create, key_results:manage, initiatives:read, initiatives:create, initiatives:manage, feedback_form_configurations:read, feedback_forms:create
   ```

4. **Save and copy credentials**
   - Copy your **Client ID**
   - Copy your **Client Secret**

## Step 2: Configure Local Environment

1. **Clone and setup repository**
   ```bash
   git clone <repository-url>
   cd productboard-mcp
   npm install
   ```

2. **Create your .env file**
   ```bash
   cp .env.example .env
   ```

3. **Edit .env with your credentials**
   ```bash
   # Required OAuth2 credentials
   PRODUCTBOARD_OAUTH_CLIENT_ID=your_client_id_here
   PRODUCTBOARD_OAUTH_CLIENT_SECRET=your_client_secret_here
   
   # Choose a preset matching your Productboard role and OAuth2 app scopes
   # Available: contributor, maker, admin, custom
   PRODUCTBOARD_OAUTH_PRESET=contributor
   
   # Authentication type
   PRODUCTBOARD_AUTH_TYPE=oauth2
   ```

## Step 3: Scope Preset Selection

Choose the preset that matches your **official Productboard role**:

### `contributor` - Most Restricted Access
- **Scopes**: `notes:create`, `users:read`, `users_pii:read`, `members_pii:read` (4 total)
- **Tools**: ~5 tools (note creation and user info)
- **Use case**: Most team members - can create customer feedback and view users
- **Productboard role**: Contributor

### `maker` - Limited Create Permissions  
- **Scopes**: All contributor scopes + `users:manage`, `releases:create`, `feedback_forms:create` (7 total)
- **Tools**: ~10 tools (notes, users, release creation, feedback forms)
- **Use case**: Team leads who can manage users and create releases
- **Productboard role**: Maker

### `admin` - Full Administrative Access
- **Scopes**: All maker scopes + full product hierarchy, custom fields, release management, objectives, key results, initiatives, plugin integrations (24 total)
- **Tools**: ~40+ tools (comprehensive product and system management including OKRs and integrations)
- **Use case**: Product managers, administrators with full system access
- **Productboard role**: Admin

## Step 4: Run OAuth2 Setup

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Run OAuth2 authorization**
   ```bash
   npm run oauth2:setup
   ```
   
3. **Follow the prompts**
   - Script will show which scopes are being requested
   - Click the authorization link
   - Complete the OAuth2 flow in your browser
   - Tokens will be saved automatically

## Step 5: Test Your Setup

1. **Start the MCP server**
   ```bash
   npm start
   ```

2. **Verify tool registration**
   - Check logs for "X tools registered, Y skipped (permissions)"
   - Should match your expected scope access

## Step 6: Configure MCP Client

Add to your MCP client configuration (e.g., Claude Desktop config at `~/Library/Application Support/Claude/claude_desktop_config.json`):

### Basic Configuration

```json
{
  "mcpServers": {
    "productboard": {
      "command": "node",
      "args": ["/full/path/to/productboard-mcp/dist/index.js"],
      "env": {
        "PRODUCTBOARD_AUTH_TYPE": "oauth2",
        "PRODUCTBOARD_OAUTH_CLIENT_ID": "your_client_id_here",
        "PRODUCTBOARD_OAUTH_CLIENT_SECRET": "your_client_secret_here",
        "PRODUCTBOARD_OAUTH_PRESET": "contributor"
      }
    }
  }
}
```

### Role-Based Configuration Examples

**For Contributors (most users):**
```json
{
  "mcpServers": {
    "productboard": {
      "command": "node", 
      "args": ["/full/path/to/productboard-mcp/dist/index.js"],
      "env": {
        "PRODUCTBOARD_AUTH_TYPE": "oauth2",
        "PRODUCTBOARD_OAUTH_CLIENT_ID": "your_client_id_here",
        "PRODUCTBOARD_OAUTH_CLIENT_SECRET": "your_client_secret_here", 
        "PRODUCTBOARD_OAUTH_PRESET": "contributor",
        "PRODUCTBOARD_API_BASE_URL": "https://api.productboard.com",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**For Makers:**
```json
{
  "mcpServers": {
    "productboard": {
      "command": "node",
      "args": ["/full/path/to/productboard-mcp/dist/index.js"],
      "env": {
        "PRODUCTBOARD_AUTH_TYPE": "oauth2",
        "PRODUCTBOARD_OAUTH_CLIENT_ID": "your_client_id_here",
        "PRODUCTBOARD_OAUTH_CLIENT_SECRET": "your_client_secret_here",
        "PRODUCTBOARD_OAUTH_PRESET": "maker",
        "PRODUCTBOARD_API_BASE_URL": "https://api.productboard.com",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**For Admins:**
```json
{
  "mcpServers": {
    "productboard": {
      "command": "node",
      "args": ["/full/path/to/productboard-mcp/dist/index.js"],
      "env": {
        "PRODUCTBOARD_AUTH_TYPE": "oauth2",
        "PRODUCTBOARD_OAUTH_CLIENT_ID": "your_client_id_here",
        "PRODUCTBOARD_OAUTH_CLIENT_SECRET": "your_client_secret_here",
        "PRODUCTBOARD_OAUTH_PRESET": "admin",
        "PRODUCTBOARD_API_BASE_URL": "https://api.productboard.com", 
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Custom Scope Override:**
```json
{
  "mcpServers": {
    "productboard": {
      "command": "node",
      "args": ["/full/path/to/productboard-mcp/dist/index.js"],
      "env": {
        "PRODUCTBOARD_AUTH_TYPE": "oauth2",
        "PRODUCTBOARD_OAUTH_CLIENT_ID": "your_client_id_here",
        "PRODUCTBOARD_OAUTH_CLIENT_SECRET": "your_client_secret_here",
        "PRODUCTBOARD_OAUTH_SCOPES": "users:read product_hierarchy_data:read notes:create",
        "PRODUCTBOARD_API_BASE_URL": "https://api.productboard.com",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Configuration Notes

1. **Replace placeholders**: Update `your_client_id_here` and `your_client_secret_here` with your actual OAuth2 credentials
2. **Update path**: Change `/full/path/to/productboard-mcp/dist/index.js` to your actual installation directory
3. **Choose preset**: Select the preset that matches your Productboard role and OAuth2 app scopes
4. **Optional settings**: Add `LOG_LEVEL` and `PRODUCTBOARD_API_BASE_URL` for additional configuration

## Troubleshooting

### ❌ "Unknown preset" error
- Your `.env` has `PRODUCTBOARD_OAUTH_PRESET=invalid_name`
- Available presets: `contributor`, `maker`, `admin`, `custom`

### ❌ "Missing required scope" during authorization
- Your Productboard OAuth2 app doesn't have the scopes that the preset requires
- Either add scopes to your Productboard app, or choose a preset with fewer scopes

### ❌ Many tools show "skipped (permissions)"
- Your preset is too restrictive for your Productboard OAuth2 app scopes
- Try a higher-level preset like `maker` or `admin`
- Ensure your Productboard user actually has the role permissions in the workspace

### ❌ Authorization fails
- Check your Client ID and Client Secret are correct
- Ensure redirect URI is exactly `http://localhost:3000/callback`
- Make sure port 3000 is not in use

## Custom Scope Configuration

If you need custom scopes, you can either:

1. **Edit the `custom` preset** in `oauth2-config.yml`
2. **Override with environment variable**:
   ```bash
   # In .env - this overrides any preset
   PRODUCTBOARD_OAUTH_SCOPES=users:read custom_fields:read notes:create
   ```

## Restarting OAuth2 Flow

If you need to clear your saved tokens and restart the OAuth2 authorization:

```bash
# Use the convenience script
chmod +x restart.sh
./restart.sh
```

Or manually:
```bash
# Remove saved tokens
rm .pb.tokens

# Re-run OAuth2 setup
npm run oauth2:setup
```

This is useful when:
- You want to change OAuth2 applications
- Your tokens are corrupted or invalid
- You need to authorize with different scopes
- Testing the fresh authorization flow

## Need Help?

1. Check `oauth2-config.yml` for available scopes and role descriptions
2. Check server logs for specific error messages
3. Ensure your Productboard user has the necessary permissions in the workspace