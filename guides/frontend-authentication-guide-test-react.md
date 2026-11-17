# Authentication Guide for Design Review and Testing

This guide explains how to authenticate with the development server when using Playwright for browser-based testing and design review.

## Prerequisites

1. Development server must be running on http://localhost:5173
2. API key must be set in `.env` file as `VITE_DEV_API_KEY`

## Authentication Flow

### Step 1: Check if server is running
```bash
lsof -i :5173
# or
curl http://localhost:5173
```

### Step 2: Navigate to development server
Use Playwright to navigate:
```
mcp__playwright__browser_navigate
url: http://localhost:5173
```

### Step 3: Detect login page
Take a snapshot to verify you're on the login page:
```
mcp__playwright__browser_snapshot
```

Look for the "API Key" label and form input in the snapshot.

### Step 4: Read API key from environment
Read the `.env` file and extract the `VITE_DEV_API_KEY` value:
```bash
grep VITE_DEV_API_KEY .env | cut -d= -f2
```

### Step 5: Fill in API key
Use the browser snapshot to get the exact element reference, then type the API key:
```
mcp__playwright__browser_type
element: "API Key input field"
ref: [element reference from snapshot]
text: [API key value from .env]
```

### Step 6: Submit the form
Click the OK button:
```
mcp__playwright__browser_click
element: "OK button"
ref: [button reference from snapshot]
```

### Step 7: Wait for navigation
Wait for successful authentication and navigation to main app:
```
mcp__playwright__browser_wait_for
time: 2
```

### Step 8: Verify authentication
Take another snapshot to confirm you're no longer on the login page:
```
mcp__playwright__browser_snapshot
```

## Troubleshooting

### Issue: Server not running
**Solution**: Start the development server with `npm run dev`

### Issue: Invalid API key
**Solution**: Check that the API key in `.env` is valid and matches the server's expected format

### Issue: Login form not found
**Solution**: Verify the snapshot shows the login page with "API Key" label and input field

### Issue: Already authenticated
**Solution**: If you're already on the main app (not login page), skip authentication steps

## Example Complete Authentication Script

```typescript
// 1. Navigate to dev server
await browser.navigate("http://localhost:5173");

// 2. Take snapshot to check current page
const snapshot = await browser.snapshot();

// 3. If on login page, authenticate
if (snapshot.includes("API Key")) {
  // 4. Read API key from .env
  const apiKey = process.env.VITE_DEV_API_KEY;

  // 5. Fill in API key field
  await browser.type({
    element: "API Key input",
    ref: "[data-ref-from-snapshot]",
    text: apiKey
  });

  // 6. Click submit button
  await browser.click({
    element: "OK button",
    ref: "[button-ref-from-snapshot]"
  });

  // 7. Wait for navigation
  await browser.waitFor({ time: 2 });

  // 8. Verify success
  const newSnapshot = await browser.snapshot();
  console.log("Authenticated:", !newSnapshot.includes("API Key"));
}
```

## Integration with Design Review

When running design reviews, authentication should happen in **Phase 0.5** (after preparation, before interaction testing). The design-review agent will automatically handle authentication if configured properly.

## Security Notes

- Never commit actual API keys to the repository
- The `.env` file should be in `.gitignore`
- API keys should be shared securely with team members
- Consider using environment-specific API keys for development vs staging
