const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, AttachmentBuilder, ActivityType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { token: TOKEN, bot_dir: BOT_DIR, client_id: CLIENT_ID } = require('./env.json');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const UPDATE_SCRIPT_PATH = `${BOT_DIR}updateTask.sh`;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('Use `/` to trigger commands', { type: ActivityType.Custom });

    const commands = [
        new SlashCommandBuilder().setName('update').setDescription('Update a task')
            .addStringOption(option => 
                option.setName('task-name').setDescription('Task name').setRequired(true)
            )
            .addStringOption(option =>
                option.setName('show-log').setDescription('Set `true` to show detail logs').setRequired(false)
            )
            .addStringOption(option =>
                option.setName('nogen').setDescription('Set `true` to update without dataset').setRequired(false)
            ),

        new SlashCommandBuilder().setName('appendtd').setDescription('Append dataset to a task')
            .addStringOption(option =>
                option.setName('task-name').setDescription('Task name').setRequired(true)
            )
            .addStringOption(option =>
                option.setName('dataset-name').setDescription('Dataset name').setRequired(true)
            )
            .addStringOption(option =>
                option.setName('show-log').setDescription('Set `true` to show detail logs').setRequired(false)
            ),

        new SlashCommandBuilder().setName('setcontest').setDescription('Set contest_id to specific contest')
            .addIntegerOption(option =>
                option.setName('contest-id').setDescription('Contest ID').setRequired(true)
            ),

        new SlashCommandBuilder().setName('unsetcontest').setDescription('Unset contest_id')
    ];

    try {
        console.log('Started refreshing application (/) commands.');

        rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

        console.log('Successfully reloaded application (/) commands.\n\n');
    } catch (error) {
        console.error(error);
    }
});

var nowon = '';

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    const { commandName, options } = interaction;

    console.log(`Command: ${commandName}\nOptions: ${JSON.stringify(options)}`);

    if (commandName === 'update') {
        const taskName = options.getString('task-name');
        const showLog = options.getString('show-log') === 'true';
        const nogen = options.getString('nogen') === 'true';

        if (nowon !== '') {
            await interaction.reply(`Processing "${nowon}" now, please try again later.`);
            return;
        }

        if (taskName === null || !/^[A-Za-z0-9_]+$/.test(taskName)) {
            await interaction.reply('`<task-name>` does not match `[A-Za-z0-9_]+`');
            return;
        }

        nowon = taskName;
        await interaction.reply(`Updating task "${taskName}"...`);

        await updateTask(taskName, showLog, nogen, false).then(async stdout => {
            if (showLog) {
                const infoLog = new AttachmentBuilder(`${BOT_DIR}log.txt`);
                await Reply(interaction, { content: `Task "${taskName}" was successfully updated.\nInfo log:`, files: [infoLog] },
                    `Task "${taskName}" was successfully updated, but info log is too large to send.`);
            } else {
                await interaction.editReply(`Task "${taskName}" was successfully updated.`);
            }
        }, async error => {
            if (error.length > 2000) {
                try {
                    fs.writeFileSync(`${BOT_DIR}/error.txt`, error);
                } catch (e) {
                    console.error(e);
                }
                const errorLog = new AttachmentBuilder(`${BOT_DIR}error.txt`);
                await Reply(interaction, { content: `Task "${taskName}" was not updated.\nError log:`, files: [errorLog] },
                    `Task "${taskName}" was not updated, but error log is too large to send.`);
            } else {
                await interaction.editReply(`Task "${taskName}" was not updated.\nError log:\`\`\`${error}\`\`\``);
            }

        }).finally(() => {
            nowon = '';
        });

    } else if (commandName === 'appendtd') {
        const taskName = options.getString('task-name');
        const datasetName = options.getString('dataset-name');
        const showLog = options.getString('show-log') === 'true';

        if (nowon !== '') {
            await interaction.reply(`Processing "${nowon}" now, please try again later.`);
            return;
        }

        if (taskName === null || !/^[A-Za-z0-9_]+$/.test(taskName)) {
            await interaction.reply('`<task-name>` does not match `[A-Za-z0-9_]+`');
            return;
        }

        if (datasetName === null || !/^[A-Za-z0-9_\-]+$/.test(datasetName)) {
            await interaction.reply('`<dataset-name>` does not match `[A-Za-z0-9_\\-]+`');
            return;
        }

        nowon = taskName;
        await interaction.reply(`Appending dataset to task "${taskName}"...`);

        await updateTask(taskName, showLog, false, true).then(async stdout => {
            if (showLog) {
                const infoLog = new AttachmentBuilder(`${BOT_DIR}log.txt`);
                await Reply(interaction, { content: `Dataset was successfully appended to task "${taskName}".\nInfo log:`, files: [infoLog] },
                    `Dataset was successfully appended to task "${taskName}", but info log is too large to send.`);
            } else {
                await interaction.editReply(`Dataset was successfully appended to task "${taskName}".`);
            }
        }, async error => {
            if (error.length > 2000) {
                try {
                    fs.writeFileSync(`${BOT_DIR}/error.txt`, error);
                } catch (e) {
                    console.error(e);
                }
                const errorLog = new AttachmentBuilder(`${BOT_DIR}error.txt`);
                await Reply(interaction, { content: `Dataset was not appended to task "${taskName}".\nError log:`, files: [errorLog] },
                    `Dataset was not appended to task "${taskName}", but error log is too large to send.`);
            } else {
                await interaction.editReply(interaction, `Dataset was not appended to task "${taskName}".\nError log:\`\`\`${error}\`\`\``);
            }

        }).finally(() => {
            nowon = '';
        });

    } else if (commandName === 'setcontest') {
        const contestId = options.getInteger('contest-id');

        if (contestId === null || contestId <= 0) {
            await interaction.reply('`<contest-id>` must be a positive integer');
            return;
        }

        const res = await setContest(contestId);
        await interaction.reply(res);
    } else if (commandName === 'unsetcontest') {
        const res = await setContest(null);
        await interaction.reply(res);
    } else {
        await interaction.reply('Unknown command');
    }
});

client.login(TOKEN);

async function updateTask(taskName, fullLog, nogen, appendtd) {
    args = [];

    args.push(taskName);

    if (fullLog == true) {
        args.push('--full-log');
    }

    if (nogen == true) {
        args.push('--nogen');
    }

    if (appendtd == true) {
        args.push('--appendtd');
    }

    return new Promise((resolve, reject) => {
        childProcess.execFile(UPDATE_SCRIPT_PATH, args, (err, stdout, stderr) => {
            if (err) {
                console.error(`ERROR:\n${err}\n`);
                reject(err.toString().replace(BOT_DIR, ''));
                return;
            }

            if (stdout) {
                stdout = stdout.replace('Enter a description: ', '');
                console.log(`STDOUT:\n${stdout}\n`);
            }

            if (stderr) {
                console.log(`STDERR:\n${stderr}\n`);
            }

            if (!stdout && !stderr) {
                reject('Error log is too large to show');
                return;
            }

            if (fullLog == true) {
                try {
                    fs.writeFileSync(`${BOT_DIR}/log.txt`, stdout);
                } catch (e) {
                    console.error(e);
                }
            }

            if(stdout.includes('Import finished')) {
                resolve(stdout.replace(BOT_DIR, ''));
            } else {
                reject(stdout.replace(BOT_DIR, ''));
            }
        });
    });
}

async function setContest(id) {
    if (id) {
        cmd = `sed -i 's/contest_id=[0-9]*/contest_id=${id}/g' ${UPDATE_SCRIPT_PATH}`;
    } else {
        cmd = `sed -i 's/contest_id=[0-9]*/contest_id=0/g' ${UPDATE_SCRIPT_PATH}`;
    }

    return new Promise((resolve, reject) => {
        childProcess.exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.error(`ERROR:\n${err}\n`);
                reject(err.toString().replace(BOT_DIR, ''));
                return;
            }

            if (id) {
                resolve(`Successfully set contest_id to ${id}`);
            } else {
                resolve('Successfully unset contest_id');
            }
        });
    });
}

async function Reply(interaction, content, error_content){
    try {
        await interaction.editReply(content);
    } catch (e) {
        console.error(e);
        await interaction.editReply(error_content);
    }
}
