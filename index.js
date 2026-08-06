require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder
} = require('discord.js');
const express = require('express');
const admin = require('firebase-admin'); 

// ==========================================
// INITIALIZE FIREBASE ADMIN SDK (SECURE)
// ==========================================
try {
    let serviceAccount;

    // If running on Render, parse the secret string variable into a JSON object
    if (process.env.FIREBASE_CONFIG_JSON) {
        serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG_JSON);
    } else {
        // Fallback for local testing if you have the file locally
        serviceAccount = require('./firebase-adminsdk.json');
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error.message);
}

// ==========================================
// EXPRESS WEB SERVER (For UptimeRobot)
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Second Bot is online 24/7!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// ==========================================
// DISCORD BOT CONFIGURATION
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers 
    ]
});

// The High Command role allowed to use these commands
const STAFF_ROLE_ID = '1533203421434351917'; 

// ==========================================
// SLASH COMMANDS DEFINITIONS
// ==========================================
const commands = [
    // /call-vc command
    new SlashCommandBuilder()
        .setName('call-vc')
        .setDescription('DM server members telling them to join a voice or stage channel')
        .addStringOption(option => 
            option.setName('link')
                .setDescription('The link to the VC or Stage channel')
                .setRequired(true)),

    // /blast-event command
    new SlashCommandBuilder()
        .setName('blast-event')
        .setDescription('DM server members telling them to look at a scheduled event')
        .addStringOption(option => 
            option.setName('link')
                .setDescription('The link to the Discord Event')
                .setRequired(true)),

    // /mass-dm command
    new SlashCommandBuilder()
        .setName('mass-dm')
        .setDescription('Send a completely custom DM message to all people in the server')
        .addStringOption(option => 
            option.setName('message')
                .setDescription('Type the exact message text you want to blast out')
                .setRequired(true)),

    // /purge command definition
    new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Wipes the entire chat history of this channel and resets it clean'),

    // /appnotif command definition
    new SlashCommandBuilder()
        .setName('appnotif')
        .setDescription('Sends a push notification containing custom text to the mobile app')
        .addStringOption(option => 
            option.setName('text')
                .setDescription('The message text to send to the phone app')
                .setRequired(true))
].map(command => command.toJSON());


// ==========================================
// BOT INITIALIZATION & REGISTER COMMANDS
// ==========================================
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        console.log('Started refreshing second bot (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded second bot (/) commands.');
    } catch (error) {
        console.error('Error deploying slash registries:', error);
    }
});

// ==========================================
// SLASH COMMAND INTERACTION ROUTER
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, member, guild } = interaction;

    // Security Check: Only allow users with the High Command staff role
    if (!member.roles.cache.has(STAFF_ROLE_ID)) {
        return interaction.reply({ 
            content: '❌ **Access Denied:** You do not have permission to use these commands.', 
            ephemeral: true 
        });
    }

    // 1. /call-vc Logic
    if (commandName === 'call-vc') {
        const vcLink = options.getString('link');
        await interaction.reply({ content: 'Starting voice/stage channel mass dming', ephemeral: true });
        const members = await guild.members.fetch();
        let successCount = 0;

        for (const [id, targetMember] of members) {
            if (targetMember.user.bot || id === interaction.user.id) continue;
            try {
                await targetMember.send(`**SSU ALERT**\nJoin the SSU right now! \n**Click here to join the VC/Stage:** ${vcLink}`);
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 200)); 
            } catch (err) {
                console.log(`Could not DM user ${targetMember.user.tag}.`);
            }
        }
        return interaction.followUp({ content: `✅ **dming finished!** Sent to ${successCount} people.`, ephemeral: true });
    }

    // 2. /blast-event Logic
    if (commandName === 'blast-event') {
        const eventLink = options.getString('link');
        await interaction.reply({ content: '⏳ Starting event direct messaging', ephemeral: true });
        const members = await guild.members.fetch();
        let successCount = 0;

        for (const [id, targetMember] of members) {
            if (targetMember.user.bot || id === interaction.user.id) continue;
            try {
                await targetMember.send(`**New ssu for you to join!**\nReact to the event if you can make it:\n**View Event:** ${eventLink}`);
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 200)); 
            } catch (err) {
                console.log(`Could not DM user ${targetMember.user.tag}.`);
            }
        }
        return interaction.followUp({ content: `✅ **dming people!** Sent to ${successCount} people.`, ephemeral: true });
    }

    // 3. /mass-dm Logic
    if (commandName === 'mass-dm') {
        const customText = options.getString('message');
        await interaction.reply({ content: '⏳ Initializing completely custom mass DM broadcast...', ephemeral: true });
        const members = await guild.members.fetch();
        let successCount = 0;

        for (const [id, targetMember] of members) {
            if (targetMember.user.bot || id === interaction.user.id) continue;
            try {
                await targetMember.send(customText);
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 200)); 
            } catch (err) {
                console.log(`Could not message user ${targetMember.user.tag}.`);
            }
        }
        return interaction.followUp({ content: `✅ **Broadcast complete!** Sent to ${successCount} users.`, ephemeral: true });
    }

    // 4. /purge Channel-Wipe Logic
    if (commandName === 'purge') {
        const staffMember = interaction.user;
        const currentChannel = interaction.channel;
        await interaction.reply({ content: '⏳ Initializing purge and reset...', ephemeral: true });

        try {
            const resetChannel = await currentChannel.clone({
                reason: `Purged and reset completely by ${staffMember.tag}`
            });
            await resetChannel.setPosition(currentChannel.position);
            await currentChannel.delete(`Purged by ${staffMember.tag}`);
            await resetChannel.send(`🗑️ **purge complete:** This channel was purged by ${staffMember}.`);
        } catch (error) {
            console.error(error);
            try {
                await interaction.followUp({ 
                    content: '❌ **Wipe Failed:** Ensure the bot has the **Manage Channels** permission toggled ON in Server Settings.', 
                    ephemeral: true 
                });
            } catch (err) {
                console.log('Interaction token already expired or channel missing.');
            }
        }
    }

    // 5. /appnotif Logic Handler
    if (commandName === 'appnotif') {
        const appMessage = options.getString('text');
        await interaction.reply({ content: '⏳ Pushing message payload to Firebase...', ephemeral: true });

        const payload = {
            notification: {
                title: 'High Command Notification',
                body: appMessage
            },
            topic: 'staff_alerts'
        };

        try {
            const response = await admin.messaging().send(payload);
            console.log('Firebase delivery successful:', response);
            return interaction.followUp({ content: '✅ **App Alert Dispatched!** Push notification successfully sent.', ephemeral: true });
        } catch (error) {
            console.error('Firebase Routing Error:', error);
            return interaction.followUp({ content: '❌ **Firebase Error:** Failed to distribute push notification.', ephemeral: true });
        }
    }
});

client.on('error', (err) => console.error('Discord Client Error:', err));

client.login(process.env.DISCORD_TOKEN);
