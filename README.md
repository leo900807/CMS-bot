# CMS-bot

A discord bot to import tps format tasks to CMS or update tasks which were imported.

Node.js version: v22.14.0

## Installation

#### 1. Install prerequisites

```bash
$ sudo apt-get install nodejs
```

#### 2. Clone CMS-bot repo

```bash
$ git clone https://github.com/leo900807/CMS-bot.git
$ cd CMS-bot
```

#### 3. Install node modules

```bash
$ npm install
```

#### 4. Edit environment variables

Copy `env.json.sample` to `env.json` and edit variable values.  
Notice that `bot_dir` should end with `/`.

Copy `updateTask.sh.sample` to `updateTask.sh` and edit `root_dir` and `repo_dir`.

#### 5. Run

```bash
$ node app.js
```
