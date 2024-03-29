require('dotenv').config();

/* package references */
const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const { setCustomRoleData, usedIds } = require("./databaseManager.js")



/* global variables */
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers
  ]
});
const { CustomRoles, MessageCaches, Roles, ServerSettings, sequelize } = require('./databaseManager.js');



/* event listeners */
client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setActivity({ name: "with /customrole!", type: Discord.ActivityType.Playing })
  sequelize.sync();
  CustomRoles.sync();
  MessageCaches.sync();
  Roles.sync();
  ServerSettings.sync();
  let serverCount = (await client.guilds.fetch()).size;
  console.log(`Currently serving ${serverCount} servers!`);
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
    if (interaction.customId.startsWith('delete-')) {
      const messageId = interaction.customId.split('-')[1];
      // delete the message with id messageId
      const message = await interaction.guild.channels.cache.get(interaction.channelId).messages.fetch(messageId).catch(() => {});
      if (message) {
        await message.delete();
      }
      return;
    }
    const message = await interaction.message.fetch();
    await MessageCaches.findOne({ where: { key: message.id } }).then(res => {
      if (res) {
        return res;
      }
      interaction.reply({
        content: "No matching request in our database!\nWe're sorry for the inconvenience, you may delete the request message.",
        ephemeral: true,
        components: [
          new Discord.MessageActionRow().addComponents(
            new Discord.MessageButton().setCustomId('delete-' + message.id).setLabel('Delete').setStyle('DANGER')
          )
        ]
      });
      return null;
    }).then(async data => {
      if (!data) return;
      const cache = JSON.parse(data.json);
      switch(data.type) {
        case 0:
          // custom role review message
          const { roleName, roleColor, roleIcon, userId } = cache;
          switch(interaction.customId) {
            case 'approve':
              setCustomRoleData(client, { name: roleName, color: roleColor, icon: roleIcon }, interaction.guild.id, userId).then(async () => {
                await interaction.update({ content: "Approved!", components: [] });
                setTimeout(() => {
                  interaction.deleteReply().then(() => {}).catch(() => {});
                }, 5000);
              }).catch(async (err) => {
                await interaction.update({ content: `There was an error while executing this command!\n\`\`\`${err}\`\`\``, components: [] });
              });
              break;
            case 'deny':
              await interaction.update({ content: "Denied!", components: [] });
              setTimeout(() => {
                interaction.deleteReply().then(() => {}).catch(() => {});
              }, 5000);
              break;
          }
          if (usedIds.includes(message.guildId + "-" + userId)) {
            usedIds.splice(usedIds.indexOf(message.guildId + "-" + userId), 1);
          }
          break;
      }
    }).catch(async (err) => { interaction.reply({ content: `There was an error while executing this command!\n\`\`\`${err}\`\`\``, ephemeral: true }) });
  }
});

/* login */
client.login(process.env.BOT_TOKEN);