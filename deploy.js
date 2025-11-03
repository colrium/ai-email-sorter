#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Deployment Script for AI Email Sorter
 * 
 * This script helps deploy the application to Fly.io
 * Run: node deploy.js
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function exec(command) {
    console.log(`\n Running: ${command}`);
    try {
        execSync(command, { stdio: 'inherit' });
        return true;
    } catch {
        console.error(` Command failed: ${command}`);
        return false;
    }
}

async function main() {
    console.log(' AI Email Sorter - Deployment Script\n');

    // Check prerequisites
    console.log(' Checking prerequisites...\n');

    try {
        execSync('flyctl version', { stdio: 'ignore' });
        console.log(' Fly CLI installed');
    } catch {
        console.error(' Fly CLI not found. Install from: https://fly.io/docs/hands-on/install-flyctl/');
        process.exit();
    }

    try {
        execSync('docker --version', { stdio: 'ignore' });
        console.log(' Docker installed');
    } catch {
        console.error('  Docker not found. Required for local builds.');
    }

    // Choose deployment type
    console.log('\n Deployment Options:\n');
    console.log('. Full deployment (first time)');
    console.log('. Update existing deployment');
    console.log('. Set secrets only');
    console.log('. Run migrations only');
    console.log('. Check deployment status\n');

    const choice = await question('Select option (-): ');

    switch (choice.trim()) {
        case '':
            await fullDeployment();
            break;
        case '':
            await updateDeployment();
            break;
        case '':
            await setSecrets();
            break;
        case '':
            await runMigrations();
            break;
        case '':
            await checkStatus();
            break;
        default:
            console.log(' Invalid option');
            process.exit();
    }

    rl.close();
}

async function fullDeployment() {
    console.log('\n Full Deployment\n');

    // Confirm
    const confirm = await question('This will deploy the app for the first time. Continue? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
        console.log('Cancelled.');
        return;
    }

    // Run tests
    console.log('\n⃣ Running tests...');
    if (!exec('yarn test:ci')) {
        const continueAnyway = await question('  Tests failed. Continue anyway? (y/n): ');
        if (continueAnyway.toLowerCase() !== 'y') {
            console.log('Deployment cancelled.');
            return;
        }
    }

    // Build locally (optional)
    console.log('\n⃣ Building locally to verify...');
    if (!exec('yarn build')) {
        console.error(' Build failed. Fix errors before deploying.');
        return;
    }

    // Initialize Fly app (if not exists)
    console.log('\n⃣ Setting up Fly app...');
    exec('flyctl launch --no-deploy');

    // Set secrets
    console.log('\n⃣ Setting secrets...');
    await setSecrets();

    // Deploy
    console.log('\n⃣ Deploying to Fly.io...');
    if (!exec('flyctl deploy --remote-only')) {
        console.error(' Deployment failed.');
        return;
    }

    // Run migrations
    console.log('\n⃣ Running database migrations...');
    await runMigrations();

    // Verify
    console.log('\n⃣ Verifying deployment...');
    await checkStatus();

    console.log('\n Deployment complete!');
    console.log('\n Next steps:');
    console.log('  . Update Google OAuth redirect URIs');
    console.log('  . Test login flow');
    console.log('  . Monitor logs: flyctl logs');
}

async function updateDeployment() {
    console.log('\n Update Deployment\n');

    // Run tests
    console.log('⃣ Running tests...');
    if (!exec('yarn test:ci')) {
        const continueAnyway = await question('  Tests failed. Continue anyway? (y/n): ');
        if (continueAnyway.toLowerCase() !== 'y') {
            console.log('Deployment cancelled.');
            return;
        }
    }

    // Deploy
    console.log('\n⃣ Deploying updates...');
    if (!exec('flyctl deploy --remote-only')) {
        console.error(' Deployment failed.');
        return;
    }

    // Check if migrations needed
    console.log('\n⃣ Checking for new migrations...');
    const runMigs = await question('Run database migrations? (y/n): ');
    if (runMigs.toLowerCase() === 'y') {
        await runMigrations();
    }

    // Verify
    console.log('\n⃣ Verifying deployment...');
    await checkStatus();

    console.log('\n Update complete!');
}

async function setSecrets() {
    console.log('\n Set Environment Secrets\n');

    console.log('Enter secrets (leave blank to skip):');

    const secrets = {};

    secrets.DATABASE_URL = await question('DATABASE_URL: ');
    secrets.REDIS_URL = await question('REDIS_URL: ');
    secrets.NEXTAUTH_URL = await question('NEXTAUTH_URL (e.g., https://your-domain.com): ');
    secrets.NEXTAUTH_SECRET = await question('NEXTAUTH_SECRET (or press Enter to generate): ');
    secrets.GOOGLE_CLIENT_ID = await question('GOOGLE_CLIENT_ID: ');
    secrets.GOOGLE_CLIENT_SECRET = await question('GOOGLE_CLIENT_SECRET: ');
    secrets.ANTHROPIC_API_KEY = await question('ANTHROPIC_API_KEY: ');
    secrets.ENCRYPTION_KEY = await question('ENCRYPTION_KEY (or press Enter to generate): ');
    secrets.CRON_SECRET = await question('CRON_SECRET (or press Enter to generate): ');

    // Generate secrets if needed
    if (!secrets.NEXTAUTH_SECRET) {
        secrets.NEXTAUTH_SECRET = execSync('openssl rand -base ').toString().trim();
        console.log(' Generated NEXTAUTH_SECRET');
    }
    if (!secrets.ENCRYPTION_KEY) {
        secrets.ENCRYPTION_KEY = execSync('openssl rand -base ').toString().trim();
        console.log(' Generated ENCRYPTION_KEY');
    }
    if (!secrets.CRON_SECRET) {
        secrets.CRON_SECRET = execSync('openssl rand -base ').toString().trim();
        console.log(' Generated CRON_SECRET');
    }

    // Build command
    const secretPairs = Object.entries(secrets)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');

    if (secretPairs) {
        console.log('\n Setting secrets on Fly.io...');
        exec(`flyctl secrets set ${secretPairs}`);
        console.log(' Secrets set successfully');
    } else {
        console.log('  No secrets provided');
    }
}

async function runMigrations() {
    console.log('\n  Running Database Migrations\n');

    if (!exec('flyctl ssh console -C "npx prisma migrate deploy"')) {
        console.error(' Migration failed.');
        return;
    }

    console.log(' Migrations completed');
}

async function checkStatus() {
    console.log('\n Deployment Status\n');

    exec('flyctl status');

    console.log('\n Health Check\n');
    const appName = 'ai-email-sorter'; // Update if different
    exec(`curl -f https://${appName}.fly.dev/api/health || echo " Health check failed"`);

    console.log('\n Recent Logs\n');
    exec('flyctl logs --lines 0');
}

// Run the script
main().catch(error => {
    console.error(' Error:', error);
    process.exit();
});

