const { Client } = require('discord.js');
const { token, bot_dir } = require('./env.json');
const child_process = require('child_process');
const fs = require('fs');

const update_script = `${bot_dir}updateTask.sh`;

commands = ['!help <command>: Show command usage',
            '!update: Update a task',
            '!update-with-log: Update a task and print info log'];

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
    switch(cmd){
        case 'help':
            if(args.length < 2)
                msg.channel.send(`\`\`\`\n${commands.join('\n')}\`\`\``);
            else
                switch(args[1]){
                    case 'update':
                        await cmsImportTask_usage().then(stdout => {
                            msg.channel.send(`\`\`\`${stdout}\`\`\``);
                        }, error => {
                            send_msg(msg, [`Some error was occured.\nError log:\`\`\`${error}\`\`\``],
                                `Some error was occured, but error log is too large to send.`);
                        });
                        break;
                    default:
                        msg.channel.send('Command not found.');
                }
            break;
        case 'update':
        case 'update-with-log':
            if(args.length < 2){
                await cmsImportTask_usage().then(stdout => {
                    msg.channel.send(`\`\`\`${stdout.replace('./updateTask.sh', `!${cmd}`)}\`\`\``);
                }, error => {
                    send_msg(msg, [`Some error was occured.\nError log:\`\`\`${error}\`\`\``],
                        `Some error was occured, but error log is too large to send.`);
                });
                break;
            }
            if(nowon !== ''){
                msg.channel.send(`Processing ${nowon} now, please wait.`);
                break;
            }
            nowon = args[1];
            msg.channel.send(`Updating task "${args[1]}"...`);
            await update_task(cmd, args.slice(1)).then(stdout => {
                if(cmd === 'update-with-log')
                    send_msg(msg, [`Task "${args[1]}" was successfully updated.\nInfo log:`, { files: [`${bot_dir}/log.txt`] }],
                        `Task "${args[1]}" was successfully updated, but info log is too large to send.`);
                else
                    msg.channel.send(`Task "${args[1]}" was successfully updated.`);
            }, error => {
                send_msg(msg, [`Task "${args[1]}" was not updated.\nError log:\`\`\`${error}\`\`\``],
                    `Task "${args[1]}" was not updated, but error log is too large to send.`);
            }).finally(() => {
                nowon = '';
            });
            break;
    }
});

client.login(token);

async function cmsImportTask_usage(){
    return new Promise((resolve, reject) => {
        child_process.exec(`${update_script} --help`, (err, stdout, stderr) => {
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
    if(cmd == 'update')
        cmd_str = `${update_script} ${task_and_options.join(' ')}`
    else
        cmd_str = `${update_script} ${task_and_options.join(' ')} --full-log`
    return new Promise((resolve, reject) => {
        child_process.exec(cmd_str, (err, stdout, stderr) => {
            if(err){
                console.error(`ERROR:\n${err}\n`);
                reject(err.toString().replace(bot_dir, ''));
                return;
            }
            if(stdout)
                console.log(`STDOUT:\n${stdout}\n`);
            if(stderr)
                console.log(`STDERR:\n${stderr}\n`);
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

async function send_msg(msg, content, error_content){
    try{
        if(content.length > 1)
            msg.channel.send(content[0], content[1]);
        else
            msg.channel.send(content[0]);
    }
    catch(e){
        console.error(e);
        msg.channel.send(error_content);
    }
}
