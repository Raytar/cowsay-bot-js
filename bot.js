#!/usr/bin/env node
const fs = require('fs');
const cmd = require('node-cmd');
const path = require('path');
const cowsay = require('cowsay.js');
const discord = require('discord.js');

const bot = new discord.Client();
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

const padMessage = (message, padding = '```') => padding + message + padding;

function getOptions(message) {
    const commandReg = /^(?:(?:(fortune)\s*\|\s*cow(say|think))|(cow(say|think)))/g;
    let command = commandReg.exec(message.content);
    if (!command) return false;

    let options = {};

    if (command[1] === 'fortune') {
        options.fortune = true;
    }

    if (command[2] && command[2] === 'think') {
        options.cowthink = true;
    }

    let content = message.content.substr(commandReg.lastIndex);

    //the properties / options that are allowed, sorted by type
    const props = {
        string: [ 'f', 'e', 'T' ],
        bool: [ 'h', 'l', 'b', 'd', 'g', 'p', 's', 't', 'w', 'y' ],
        num: ['W']
    };

    const optionReg = /-([A-z])\b/g;
    let res;
    let lastIndex = commandReg.lastIndex;

    const getValue = (prop, index) => {
        const valueReg = /^-([A-z])\s([^-\s][\S]*)\b/;
        let search = valueReg.exec(content.substr(index));

        if (search && search[1] === prop) {
            lastIndex = index + search[0].length;
            return search[2];
        } else {
            throw new Error(`Missing value for option: ${prop}`);
        }
    };

    //extracting options and values
    while ((res = optionReg.exec(content)) !== null) {
        lastIndex = res.index + res[0].length;
        if (res.index === optionReg.lastIndex) {
            optionReg.lastIndex++;
        }

        let prop = res[1];
        if (props.string.includes(prop)) {
            options[prop] = getValue(prop, res.index);
        } else if (props.bool.includes(prop)) {
            options[prop] = true;
        } else if (props.num.includes(prop)) {
            let val = parseInt(getValue(prop, res.index));
            if (isNaN(val)) throw new Error(`-${prop} has to be followed by an integer.`);
            else options[prop] = val;
        }
    }

    //extracting text
    if (content[++lastIndex]) {
        let rawText = content.substr(lastIndex);
        let text = '';

        //extract text from blocks
        const blockReg = /`{3}([\s\S]*?)`{3}/g;
        let match;
        let lastBlockEnd = 0;

        while ((match = blockReg.exec(rawText)) !== null) {
            if (match.index === blockReg.lastIndex) {
                blockReg.lastIndex++;
            }

            //add text that is before the block
            if (match.index !== 0) {
                text += rawText.substr(lastBlockEnd, match.index - lastBlockEnd) + '\n';
            } else if (lastBlockEnd !== 0) {
                text += '\n';
            }

            //add the text in the block, removing leading newline
            text += (match[1].startsWith('n')) ? match[1].substr(1, match[1].length - 1) : match[1];

            lastBlockEnd = blockReg.lastIndex;
        }

        //if no blocks were found, we output the rawtext. Else we output the processed text.
        options.text = (text === '') ? rawText : text;
    }

    //need to provide own helptext
    if (options.h) {
        options.text = `\
Usage: {cowsay | cowthink} [options] [message]

Options:

-bdgpstwy modifiers
-h help (this text)
-e eyes
-f face
-l lists faces
-T Tongue
-W wrap`;
    }

    return options;
}

function getFortune() {
    if (config.fortune) {
        return new Promise((resolve) => {
            cmd.get('fortune', (err, data) => {
                //remove trailing newline
                data = data.replace(/\n$/, '');
                resolve(data);
            });
        });
    } else {
        return 'fortune is disabled.';
    }
}

function getCowsay(options) {
    let cowFunc;

    if (options.cowthink) {
        cowFunc = cowsay.think;
    } else {
        cowFunc = cowsay.say;
    }

    try {
        return cowFunc(options);
    } catch(err) {
        return `error: ${err.message}`;
    }
}

//wiring up the bot
bot.on('message', (message) => {

    let options;
    try {
        options = getOptions(message);
    } catch(err) {
        message.channel.send(`Error: ${err.message}`);
    }

    if (!options) return;

    if (options.fortune) {
        getFortune().then((fortune) => {
            options.text = fortune;
            let content = getCowsay(options);
            message.channel.send(padMessage(content));
        }).catch((err) => {
            message.channel.send(padMessage(cowsay.say({text: `Failed to get fortune: ${err.message}`})));
        });
    } else {
        let content = getCowsay(options);
        message.channel.send(padMessage(content));
    }
});

bot.on('ready', () => {
    console.log(cowsay.say({text: 'Bot is ready'}));
    bot.user.setGame('cowsay -h');
});

bot.login(config.token);
