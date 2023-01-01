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
  let name = interaction.options.getString('name');
  let color = interaction.options.getString('color');
  let icon = interaction.options.getString('icon');
  if (!interaction.member.premiumSince) return interaction.reply({ content: 'You must be a server booster to use this command!', ephemeral: true });
  getCustomRoleData(interaction.guildId, interaction.user.id).then(customRole => {
    const role = interaction.guild.roles.cache.get(customRole.id);
    if (!name && !color && !icon) return interaction.reply({ content: `Your custom role: <@&${role.id}>`, ephemeral: true });
    if (!name) name = role.name ?? "new role";
    if (!color) color = role.hexColor ?? "#000000";
    if (!icon) {
      icon = customRole.icon ?? "";
    }
    if (icon.toLowerCase() == 'none') {
      icon = "";
      role.edit({ icon: null });
    };
    console.log(name, color, icon);
    setCustomRoleData(client, {name, color, icon}, interaction.guildId, interaction.user.id).then(() => {
      interaction.reply({ content: 'Custom role updated!', ephemeral: true });
    }).catch((err) => {
      interaction.reply({ content: 'An error occurred while updating your custom role!', ephemeral: true });
    });
  }).catch(() => {
    if (!name) return interaction.reply({ content: 'You must provide a name for your role!', ephemeral: true });
    if (!/^#[0-9A-Fa-f]{6}$/i.test(color)) return interaction.reply({ content: 'Invalid color!', ephemeral: true });
    if (!icon || icon.toLowerCase() == 'none') icon = "";
    setCustomRoleData(client, {name, color, icon}, interaction.guildId, interaction.user.id).then(() => {
      interaction.reply({ content: 'Custom role created!', ephemeral: true });
    }).catch(() => {
      interaction.reply({ content: 'An error occurred while creating your custom role!', ephemeral: true });
    });
  });
}

module.exports = { data, execute };