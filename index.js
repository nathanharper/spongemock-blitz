const absurd = require('absurdify');
const express = require('express');
const bodyParser = require('body-parser');
const { WebClient } = require('@slack/web-api');
const { faker } = require('@faker-js/faker');
const randomInsult = require('./cusser.js');
const discord = require('./discord');
const {verifyKeyMiddleware} = require('discord-interactions');

const dotenv = require('dotenv');
dotenv.config();

/** Bot scopes for GET /slack/install → oauth/v2/authorize (comma-separated). */
const SLACK_OAUTH_BOT_SCOPES =
    process.env.SLACK_BOT_SCOPES ||
    'commands,incoming-webhook,users:read,chat:write';

const port = process.env.PORT || 80;

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/slack/install', slackOauthAuthorizeRedirect);
app.get('/slack/oauth/callback', slackOauthCallback);

app.all('/', spongemock);
app.all('/spongemock', spongemock);
app.all('/clapback', clapback);
app.all('/insult', insult);
app.all('/randomizer', randomizer);
app.all('/discord', verifyKeyMiddleware(process.env.PUBLIC_KEY), discord);

app.listen(port, () => console.log(`Spongemock is running on port ${port}!`));

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function slackOauthAuthorizeRedirect(req, res) {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    if (!clientId || !redirectUri) {
        res.status(500).type('html').send(
            '<p>Configure <code>SLACK_CLIENT_ID</code> and <code>SLACK_REDIRECT_URI</code>.</p>'
        );
        return;
    }
    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', SLACK_OAUTH_BOT_SCOPES);
    url.searchParams.set('redirect_uri', redirectUri);
    res.redirect(302, url.toString());
}

async function slackOauthCallback(req, res) {
    const oauthError = req.query.error;
    if (oauthError) {
        res.status(400)
            .type('html')
            .send(`<p>OAuth error: ${escapeHtml(oauthError)}</p>`);
        return;
    }

    const code = req.query.code;
    if (!code || typeof code !== 'string') {
        res.status(400).type('html').send('<p>Missing <code>code</code>.</p>');
        return;
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
        res.status(500).type('html').send(
            '<p>Configure <code>SLACK_CLIENT_ID</code>, <code>SLACK_CLIENT_SECRET</code>, and <code>SLACK_REDIRECT_URI</code>.</p>'
        );
        return;
    }

    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
    });

    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });

    const data = await tokenRes.json();
    if (!data.ok) {
        res.status(400)
            .type('html')
            .send(
                `<p>oauth.v2.access failed: ${escapeHtml(data.error || 'unknown')}</p>`
            );
        return;
    }

    // OAuth v2 success: bot token is access_token when token_type is "bot"
    const botToken = data.access_token;
    const teamName = data.team?.name || data.team?.id || 'workspace';
    const tokenType = data.token_type || 'bot';

    if (!botToken) {
        res.status(500).type('html').send(
            '<p>Unexpected response: no <code>access_token</code>. Check oauth.v2 payload.</p>'
        );
        return;
    }

    if (data.incoming_webhook?.url) {
        console.log('[slack oauth] incoming_webhook URL issued (store in env or secrets if you use it)');
    }

    let webhookNote = '';
    if (data.incoming_webhook?.url) {
        webhookNote = `<p>Incoming webhook URL (store securely):</p><pre>${escapeHtml(data.incoming_webhook.url)}</pre>`;
    }

    res.type('html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Slack app installed</title></head>
<body>
  <p>Installed to <strong>${escapeHtml(teamName)}</strong> (token type: ${escapeHtml(tokenType)}).</p>
  <p>Set this as <code>SLACK_BOT_TOKEN</code> for this server:</p>
  <pre>${escapeHtml(botToken)}</pre>
  ${webhookNote}
</body></html>`);
}

const clap = ':clap:';
function getData(req) {
    return req.method === 'POST' ? req.body : req.query;
}

function slackTokenMissing(res) {
    res.json({
        response_type: 'ephemeral',
        text: 'Slack bot token missing. Set SLACK_BOT_TOKEN in the environment.',
    });
}

function slackNeedsChannel(res) {
    res.json({
        response_type: 'ephemeral',
        text: 'This command must be run from Slack in a channel or DM the bot can post in.',
    });
}

async function postSlashCommandError(responseUrl, message) {
    if (!responseUrl) {
        return;
    }
    try {
        await fetch(responseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                response_type: 'ephemeral',
                text: `Command failed: ${message}`,
            }),
        });
    } catch (_) {
        /* ignore */
    }
}

function spongemock(req, res) {
    if (!process.env.SLACK_BOT_TOKEN) {
        slackTokenMissing(res);
        return;
    }
    const data = getData(req);
    if (!data.channel_id) {
        slackNeedsChannel(res);
        return;
    }

    let { user_id, text } = data;
    text = (text || '').trim();
    let user = `<@${user_id}>`;

    //  if the text starts with ampersand, use that value as the quoted user to display.
    if (/^@/.test(text)) {
        const [userString, ...theRest] = text.split(' ');
        user = userString;
        text = theRest.join(' ');
    }

    const blocks = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: absurd(text || ''),
            },
        },
        {
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `Posted by ${user}`,
                },
            ],
        },
    ];

    res.json({ response_type: 'ephemeral', text: 'Posting…' });

    void (async () => {
        const client = new WebClient(process.env.SLACK_BOT_TOKEN);
        const post = await client.chat.postMessage({
            channel: data.channel_id,
            text: absurd(text || ''),
            blocks,
        });
        if (!post.ok) {
            throw new Error(post.error || 'chat.postMessage failed');
        }
    })().catch((err) => {
        console.error('[spongemock]', err);
        void postSlashCommandError(data.response_url, err.message || String(err));
    });
}

function clapback(req, res) {
    if (!process.env.SLACK_BOT_TOKEN) {
        slackTokenMissing(res);
        return;
    }
    const data = getData(req);
    if (!data.channel_id) {
        slackNeedsChannel(res);
        return;
    }

    const text = (data.text || '').trim();
    const bodyText = `${text.split(' ').join(` ${clap} `)} ${clap}`;
    const blocks = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: bodyText,
            },
        },
    ];

    res.json({ response_type: 'ephemeral', text: 'Posting…' });

    void (async () => {
        const client = new WebClient(process.env.SLACK_BOT_TOKEN);
        const post = await client.chat.postMessage({
            channel: data.channel_id,
            text: bodyText,
            blocks,
        });
        if (!post.ok) {
            throw new Error(post.error || 'chat.postMessage failed');
        }
    })().catch((err) => {
        console.error('[clapback]', err);
        void postSlashCommandError(data.response_url, err.message || String(err));
    });
}

function insult(req, res) {
    if (!process.env.SLACK_BOT_TOKEN) {
        slackTokenMissing(res);
        return;
    }
    const data = getData(req);
    if (!data.channel_id) {
        slackNeedsChannel(res);
        return;
    }

    const insultText = randomInsult();
    const blocks = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: insultText,
            },
        },
    ];

    res.json({ response_type: 'ephemeral', text: 'Posting…' });

    void (async () => {
        const client = new WebClient(process.env.SLACK_BOT_TOKEN);
        const post = await client.chat.postMessage({
            channel: data.channel_id,
            text: insultText,
            blocks,
        });
        if (!post.ok) {
            throw new Error(post.error || 'chat.postMessage failed');
        }
    })().catch((err) => {
        console.error('[insult]', err);
        void postSlashCommandError(data.response_url, err.message || String(err));
    });
}

async function listAllWorkspaceMembers(client) {
    const members = [];
    let cursor;
    do {
        const page = await client.users.list({ limit: 200, cursor });
        if (!page.ok) {
            throw new Error(page.error || 'users.list failed');
        }
        members.push(...(page.members || []));
        cursor = page.response_metadata?.next_cursor;
    } while (cursor);
    return members;
}

function pickRandomHumanMember(members) {
    const eligible = members.filter(
        (m) =>
            m &&
            !m.deleted &&
            !m.is_bot &&
            m.name !== 'slackbot' &&
            !m.is_stranger
    );
    if (!eligible.length) {
        throw new Error('No eligible workspace members found.');
    }
    return eligible[Math.floor(Math.random() * eligible.length)];
}

async function runRandomizer(data) {
    const client = new WebClient(process.env.SLACK_BOT_TOKEN);
    const channel = data.channel_id;
    const members = await listAllWorkspaceMembers(client);
    const chosen = pickRandomHumanMember(members);
    const imageUrl = faker.image.urlPicsumPhotos({
        width: 800,
        height: 500,
        blur: 0,
        grayscale: false,
    });

    const post = await client.chat.postMessage({
        channel,
        text: `<@${chosen.id}> you've been randomized!`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `<@${chosen.id}> *You've been randomized!* :game_die: Identify this image as fast as you can!`,
                },
            },
            {
                type: 'image',
                image_url: imageUrl,
                alt_text: 'Random photo (Picsum Photos)',
            },
        ],
    });

    if (!post.ok) {
        throw new Error(post.error || 'chat.postMessage failed');
    }
}

function randomizer(req, res) {
    if (!process.env.SLACK_BOT_TOKEN) {
        slackTokenMissing(res);
        return;
    }

    const data = getData(req);
    if (!data.channel_id) {
        slackNeedsChannel(res);
        return;
    }

    res.json({
        response_type: 'ephemeral',
        text: 'Picking someone and posting…',
    });

    void runRandomizer(data).catch((err) => {
        console.error('[randomizer]', err);
        void postSlashCommandError(data.response_url, err.message || String(err));
    });
}
