const { Client } = require('discord.js');
const { token, bot_dir } = require('./env.json');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const update_script = `${bot_dir}updateTask.sh`;

commands = [
    '!help <command>: Show command usage',
    '!update <task-name> [options]: Update a task',
    '!update-with-log <task-name> [options]: Update a task and print info log',
    '!setcontest <contest-id>: Set contest_id to specific contest',
    '!unsetcontest: Unset contest_id'
];

const client = new Client();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('!help');
});

var nowon = '';

client.on('message', async msg => {
    if (!msg.content.startsWith('!'))
        return;
    console.log(msg.content);
    let args = msg.content.substring(1).split(' ');
    let cmd = args[0];
    let res;
    switch(cmd){
        case 'help':
            if(args.length < 2)
                await msg.channel.send(`\`\`\`\n${commands.join('\n')}\`\`\``);
            else
                switch(args[1]){
                    case 'update':
                    case 'update-with-log':
                        await cmsImportTask_usage().then(async stdout => {
                            await msg.channel.send(`\`\`\`${stdout.replace('./updateTask.sh', `!${args[1]}`)}\`\`\``);
                        }, async error => {
                            await send_msg(msg, [`Some error was occured.\nError log:\`\`\`${error}\`\`\``],
                                `Some error was occured, but error log is too large to send.`);
                        });
                        break;
                    case 'setcontest':
                        await msg.channel.send('```!setcontest <contest-id>: Set contest_id to specific contest```');
                        break;
                    case 'unsetcontest':
                        await msg.channel.send('```!unsetcontest: Unset contest_id```');
                        break;
                    default:
                        await msg.channel.send('Command not found.');
                }
            break;
        case 'update':
        case 'update-with-log':
            if(args.length < 2){
                await cmsImportTask_usage().then(async stdout => {
                    await msg.channel.send(`\`\`\`${stdout.replace('./updateTask.sh', `!${cmd}`)}\`\`\``);
                }, async error => {
                    await send_msg(msg, [`Some error was occured.\nError log:\`\`\`${error}\`\`\``],
                        `Some error was occured, but error log is too large to send.`);
                });
                break;
            }
            if(nowon !== ''){
                await msg.channel.send(`Processing "${nowon}" now, please try again later.`);
                break;
            }
            if(!/^[A-Za-z0-9_]+$/.test(args[1])){
                await msg.channel.send(`\`<task-name>\` does not match \`[A-Za-z0-9_]+\``);
                break;
            }
            nowon = args[1];
            await msg.channel.send(`Updating task "${args[1]}"...`);
            await update_task(cmd, args.slice(1)).then(async stdout => {
                if(cmd === 'update-with-log')
                    await send_msg(msg, [`Task "${args[1]}" was successfully updated.\nInfo log:`, { files: [`${bot_dir}/log.txt`] }],
                        `Task "${args[1]}" was successfully updated, but info log is too large to send.`);
                else
                    await msg.channel.send(`Task "${args[1]}" was successfully updated.`);
            }, async error => {
                try{
                    fs.writeFileSync(`${bot_dir}/error.txt`, error);
                }
                catch(e){
                    console.error(e);
                }
                await send_msg(msg, [`Task "${args[1]}" was not updated.\nError log:`, { files: [`${bot_dir}/error.txt`] }],
                    `Task "${args[1]}" was not updated, but error log is too large to send.`);
            }).finally(() => {
                nowon = '';
            });
            break;
        case 'setcontest':
            if(args.length != 2){
                await msg.channel.send('```!setcontest <contest-id>: Set contest_id to the specific contest```');
                break;
            }
            if(!is_posinteger(args[1])){
                await msg.channel.send('`<contest-id>` must be a positive integer');
                break;
            }
            res = await setcontest(Number(args[1]));
            await msg.channel.send(res);
            break;
        case 'unsetcontest':
            if(args.length != 1){
                await msg.channel.send('```!unsetcontest: Unset contest_id```');
                break;
            }
            res = await setcontest(0);
            await msg.channel.send(res);
            break;
    }
});

client.login(token);

async function cmsImportTask_usage(){
    return new Promise((resolve, reject) => {
        child_process.execFile(update_script, ['--help'], (err, stdout, stderr) => {
            if(err){
                console.error(`ERROR:\n${err}\n`);
                reject(err.toString().replace(bot_dir, ''));
                return;
            }
            resolve(stdout);
        });
    });
}

async function update_task(cmd, task_and_options){
    if(cmd === 'update-with-log')
        task_and_options.push('--full-log');
    return new Promise((resolve, reject) => {
        child_process.execFile(update_script, task_and_options, (err, stdout, stderr) => {
            if(err){
                console.error(`ERROR:\n${err}\n`);
                reject(err.toString().replace(bot_dir, ''));
                return;
            }
            if(stdout)
                console.log(`STDOUT:\n${stdout}\n`);
            if(stderr)
                console.log(`STDERR:\n${stderr}\n`);
            if(!stdout && !stderr){
                reject('Error log is too large to show');
                return;
            }
            if(cmd === 'update-with-log')
                try{
                    fs.writeFileSync(`${bot_dir}/log.txt`, stdout);
                }
                catch(e){
                    console.error(e);
                }
            if(stdout.includes('Import finished'))
                resolve(stdout.replace(bot_dir, ''));
            else
                reject(stdout.replace(bot_dir, ''));
        });
    });
}

async function setcontest(id){
    const script_path = path.join(__dirname, 'updateTask.sh');
    if(id)
        cmd = `sed -i 's/contest_id=[0-9]*/contest_id=${id}/g' ${script_path}`;
    else
        cmd = `sed -i 's/contest_id=[0-9]*/contest_id=0/g' ${script_path}`;
    return new Promise((resolve, reject) => {
        child_process.exec(cmd, (err, stdout, stderr) => {
            if(err){
                console.error(`ERROR:\n${err}\n`);
                reject(err.toString().replace(bot_dir, ''));
                return;
            }
            if(id)
                resolve(`Successfully set contest_id to ${id}`);
            else
                resolve('Successfully unset contest_id');
        });
    });
}

function is_posinteger(x){
    if(typeof x !== "string")
        return false;
    const num = Number(x);
    return Number.isInteger(num) && num > 0;
}

async function send_msg(msg, content, error_content){
    try{
        if(content.length > 1)
            await msg.channel.send(content[0], content[1]);
        else
            await msg.channel.send(content[0]);
    }
    catch(e){
        console.error(e);
        await msg.channel.send(error_content);
    }
}
