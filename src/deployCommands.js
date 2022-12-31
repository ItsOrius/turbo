require("dotenv").config();

const { ApplicationCommand, Guild, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { clientId } = require('./config.json');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, "./commands")).filter(file => file.endsWith('.js'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
	const command = require(path.join(__dirname, `./commands/${file}`));
	commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

// deploy commands
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} commands.`);
		const globalData = await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		);
		console.log(`Successfully reloaded ${commands.length} commands.`);
	} catch (error) {
		console.log(error);
	}
})();

/**
 * @param {Guild} guild 
 * @param {SlashCommandBuilder} command 
 * @returns {ApplicationCommand}
 */
function publishGuildCommand(guild, command) {
	return guild.commands.create(command);
}

/**
 * @param {Guild} guild
 * @returns {Promise<ApplicationCommand[]>}
 */
function resetGuildCommands(guild) {
	return guild.commands.set([]);
}

module.exports = { publishGuildCommand, resetGuildCommands };