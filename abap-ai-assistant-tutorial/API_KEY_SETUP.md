# OpenAI API Key Setup Guide

## Getting Your OpenAI API Key

### Step 1: Create an OpenAI Account

1. Visit https://platform.openai.com/
2. Click "Sign up" if you don't have an account
3. Complete the registration process
4. Verify your email address

### Step 2: Add Payment Method

1. Log in to your OpenAI account
2. Go to **Settings** > **Billing**
3. Add a payment method (credit/debit card)
4. Add initial credits ($5-$10 recommended to start)

> **Note**: OpenAI requires a payment method even though usage is pay-as-you-go. New accounts may receive free credits.

### Step 3: Generate API Key

1. Navigate to **API Keys** section: https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Give it a name (e.g., "ABAP AI Assistant")
4. **Important**: Copy the key immediately - you won't see it again!
5. Store it securely (password manager recommended)

### Step 4: Configure in Plugin

1. Open Eclipse
2. Open Preferences:
   - **macOS**: `Eclipse > Preferences` (or press `⌘,`)
   - **Windows/Linux**: `Window > Preferences`
3. Navigate to `ABAP AI Assistant`
4. Paste your API key in the "OpenAI API Key" field
5. Select your preferred model (GPT-4o-mini recommended)
6. Click **"Test OpenAI Connection"** to verify
7. Click **"Apply and Close"**

## Security Best Practices

### ⚠️ NEVER:
- Commit API keys to version control (Git, SVN, etc.)
- Share API keys in emails or chat
- Hard-code API keys in source code
- Store API keys in plain text files in your project
- Share screenshots containing your API key

### ✅ DO:
- Store API keys in Eclipse preferences (done automatically)
- Use environment variables for CI/CD
- Rotate keys periodically
- Set usage limits in OpenAI dashboard
- Use separate keys for dev/prod environments

## Cost Management

### Understanding Costs

OpenAI charges per token (roughly 4 characters = 1 token):

| Model | Input Cost | Output Cost | Recommended For |
|-------|-----------|-------------|-----------------|
| GPT-4o-mini | $0.15/1M tokens | $0.60/1M tokens | ⭐ Daily use |
| GPT-4o | $2.50/1M tokens | $10/1M tokens | Complex analysis |
| GPT-4-turbo | $10/1M tokens | $30/1M tokens | Production critical |
| GPT-3.5-turbo | $0.50/1M tokens | $1.50/1M tokens | Budget option |

### Estimated Usage

**For typical ABAP files:**

- Small file (50-100 lines): ~500 tokens input, 300 tokens output
  - Cost with GPT-4o-mini: ~$0.0003 per analysis
  
- Medium file (200-500 lines): ~2000 tokens input, 500 tokens output
  - Cost with GPT-4o-mini: ~$0.001 per analysis
  
- Large file (1000+ lines): ~5000 tokens input, 1000 tokens output
  - Cost with GPT-4o-mini: ~$0.002 per analysis

**Daily usage estimates:**

- 50 file analyses/day with GPT-4o-mini: ~$0.05/day = $1.50/month
- 200 file analyses/day with GPT-4o-mini: ~$0.20/day = $6/month

### Setting Usage Limits

1. Go to https://platform.openai.com/settings/organization/billing/limits
2. Set **soft limit** (receive email notification)
3. Set **hard limit** (API stops working)
4. Recommended starting limits: $10 soft, $20 hard

### Monitoring Usage

1. Visit https://platform.openai.com/usage
2. View usage by:
   - Date
   - Model
   - Cost
3. Set up billing alerts

## Cost Optimization Tips

### 1. Choose the Right Model
```
GPT-4o-mini: Best for 95% of use cases
GPT-4o: Only when you need maximum accuracy
```

### 2. Control Auto-Analysis
- Disable auto-analysis in preferences
- Use manual analysis only when needed
- Analyze specific files, not entire projects

### 3. Use Rule-Based Mode
- Toggle "Use OpenAI" off in preferences
- Switch to AI only for complex files
- Good for offline work

### 4. Batch Analysis
- Analyze multiple related files together
- Share context across files
- More efficient than per-file analysis

## Troubleshooting

### "API key not configured"
- Check you've entered the key in preferences
- Ensure no extra spaces before/after the key
- Try copying the key again from OpenAI dashboard

### "Failed to connect to OpenAI API"
**Possible causes:**
1. **Invalid API key**: Verify key is correct
2. **No credits**: Check billing at https://platform.openai.com/account/billing
3. **Network issues**: Check firewall/proxy settings
4. **Rate limit**: You've exceeded API rate limits
5. **Expired key**: Generate a new key

### "Insufficient credits"
- Add funds to your OpenAI account
- Check payment method is valid
- View billing at https://platform.openai.com/account/billing

### "Rate limit exceeded"
OpenAI has rate limits based on your tier:

| Tier | RPM | TPM |
|------|-----|-----|
| Free | 3 | 40,000 |
| Tier 1 | 500 | 90,000 |
| Tier 2 | 5,000 | 450,000 |

**Solutions:**
- Wait a few minutes before retrying
- Disable auto-analysis
- Upgrade your OpenAI tier

## API Key Rotation

It's good practice to rotate keys periodically:

1. Generate new key in OpenAI dashboard
2. Update key in Eclipse preferences
3. Test the new key
4. Delete old key from OpenAI dashboard

Recommended: Rotate every 90 days

## Enterprise Setup

For team/company use:

### Option 1: Individual Keys
- Each developer gets their own API key
- Company reimburses based on usage
- Better accountability

### Option 2: Shared Organization Key
- Create an OpenAI organization
- Generate organization-level API key
- Set usage limits per user
- Centralized billing

### Option 3: API Proxy
- Set up internal proxy for OpenAI API
- Manage keys centrally
- Add additional logging/auditing
- Control which models are available

## Getting Help

- **OpenAI Help**: https://help.openai.com/
- **API Documentation**: https://platform.openai.com/docs
- **Status Page**: https://status.openai.com/
- **Community Forum**: https://community.openai.com/

## Free Tier & Credits

### New Account Credits
- New accounts may receive $5-$18 in free credits
- Credits expire after 3-4 months
- Check your account for current balance

### Educational Discounts
- Some educational institutions have partnerships with OpenAI
- Check with your university/school

### Alternative: Azure OpenAI
- Microsoft Azure also provides OpenAI models
- May have different pricing/terms
- Consider for enterprise deployments

---

**Remember**: Keep your API key secure, monitor your usage, and start with GPT-4o-mini for cost-effective analysis!


