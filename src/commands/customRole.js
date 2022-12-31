const Discord = require('discord.js');
const { getCustomRoleData, setCustomRoleData } = require('../databaseManager.js');

const data = new Discord.SlashCommandBuilder()
  .setName('customrole')
  .setDescription('Create a custom role for yourself!')
  .addStringOption(option => option.setName('name').setDescription('The name of your role.'))
  .addStringOption(option => option.setName('color').setDescription('The hexadecimal color of your role. For example, #00CCFF.').setMinLength(7).setMaxLength(7))
  .addStringOption(option => option.setName('icon').setDescription('A URL for the icon of the role. Type "NONE" to remove it.'));

/**
 * 
 * @param {Discord.Client} client 
 * @param {Discord.CommandInteraction} interaction 
 */
function execute(client, interaction) {
  const name = interaction.options.getString('name');
  const color = interaction.options.getString('color');
  const icon = interaction.options.getString('icon');
  if (!interaction.member.premiumSince) return interaction.reply({ content: 'You must be a server booster to use this command!', ephemeral: true });
  if (!/^#[0-9A-Fa-f]{6}$/i.test(color)) return interaction.reply({ content: 'Invalid color!', ephemeral: true });
  if (icon.toLowerCase() == 'none') icon = "";
  getCustomRoleData(interaction.guildId, interaction.user.id).then(customRole => {
    setCustomRoleData(client, {name, color, icon}, interaction.guildId, interaction.user.id).then(() => {
      interaction.reply({ content: 'Custom role updated!', ephemeral: true });
    }).catch((err) => {
      interaction.reply({ content: 'An error occurred while updating your custom role!', ephemeral: true });
    });
  }).catch(() => {
    if (!name) return interaction.reply({ content: 'You must provide a name for your role!', ephemeral: true });
    setCustomRoleData(client, { name: name, color: color, icon: icon }, interaction.guildId, interaction.user.id).then(() => {
      interaction.reply({ content: 'Custom role created!', ephemeral: true });
    }).catch((err) => {
      interaction.reply({ content: 'An error occurred while creating your custom role!', ephemeral: true });
    });
  });
}

module.exports = { data, execute };