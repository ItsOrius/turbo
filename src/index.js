require('dotenv').config();

/* package references */
const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const { setCustomRoleData } = require("./databaseManager.js")



/* global variables */
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.Guilds
  ]
});
const { CustomRoles, MessageCaches, Roles, ServerSettings, sequelize } = require('./databaseManager.js');



/* event listeners */
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setActivity({ name: "with /customrole!", type: Discord.ActivityType.Playing })
  sequelize.sync();
  CustomRoles.sync();
  MessageCaches.sync();
  Roles.sync();
  ServerSettings.sync();
});

fs.readdirSync(path.join(__dirname, "./events")).forEach(file => {
  const event = require(path.join(__dirname, `./events/${file}`));
  client.on(file.split('.')[0], (...args) => event(client, ...args));
});



/* command handler */
client.commands = new Discord.Collection();
fs.readdirSync(path.join(__dirname, "./commands")).forEach(file => {
  const { data, execute } = require(path.join(__dirname, `./commands/${file}`));
  client.commands.set(data.name, { data, execute });
});

client.on('interactionCreate', async interaction => {
  // command handler
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(client, interaction);
    } catch (error) {
      await interaction.reply({ content: `There was an error while executing this command!\n\`\`\`${error}\`\`\``, ephemeral: true });
    }
    return;
  }
  // button handler
  if (interaction.isButton()) {
    const message = await interaction.message.fetch();
    await MessageCaches.findOne({ where: { key: message.id } }).then(res => res.toJSON()).then(async data => {
      const cache = JSON.parse(data.json);
      switch(data.type) {
        case 0:
          // custom role review message
          const { roleName, roleColor, roleIcon, userId } = cache;
          switch(interaction.customId) {
            case 'approve':
              setCustomRoleData(client, { name: roleName, color: roleColor, icon: roleIcon }, interaction.guild.id, userId).then(async () => {
                await interaction.update({ content: "Approved!", components: [] });
                setTimeout(() => interaction.deleteReply(), 5000);
              }).catch(async (err) => {
                await interaction.update({ content: `There was an error while executing this command!\n\`\`\`${err}\`\`\``, components: [] });
              });
              break;
            case 'deny':
              await interaction.update({ content: "Denied!", components: [] });
              setTimeout(() => interaction.deleteReply(), 5000);
              break;
          }
      }
    }).catch(async (err) => { interaction.reply({ content: `There was an error while executing this command!\n\`\`\`${err}\`\`\``, ephemeral: true }) });
  }
});

/* login */
client.login(process.env.BOT_TOKEN);