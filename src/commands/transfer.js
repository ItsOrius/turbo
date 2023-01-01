const Discord = require('discord.js');
const { CustomRoles, Roles, getKey } = require("../databaseManager.js");

const data = new Discord.SlashCommandBuilder()
  .setName('transfer')
  .setDescription("Transfer outdated booster roles to Turbo's database.")
  .addRoleOption(option => option.setName('start_role').setDescription('The top (first) role that you would like to start the transfer at.').setRequired(true))
  .addRoleOption(option => option.setName('end_role').setDescription('The bottom (final) role that you would like to stop the transfer at.').setRequired(true))
  .addBooleanOption(option => option.setName('inclusive').setDescription('Should the transfer INCLUDE the start/end roles?').setRequired(true));

/**
 * @param {Discord.Client} client 
 * @param {Discord.CommandInteraction} interaction 
 */
async function execute(client, interaction) {
  const start_role = interaction.options.getRole('start_role');
  const end_role = interaction.options.getRole('end_role');
  const inclusive = interaction.options.getBoolean('inclusive');
  const guild = interaction.guild;
  if (!interaction.memberPermissions.has(Discord.PermissionFlagsBits.Administrator) && !interaction.memberPermissions.has(Discord.PermissionFlagsBits.ManageRoles)) {
    await interaction.reply({ content: "You do not have permission to use this command!", ephemeral: true });
    return;
  }
  if (start_role.position < end_role.position) {
    await interaction.reply({ content: "The start role must be higher than the end role!", ephemeral: true });
    return;
  }
  // get array of every role between the start and end roles, unless inclusive is true
  const collection = guild.roles.cache.filter(role => role.position < start_role.position && role.position > end_role.position);
  if (inclusive) {
    collection.push(start_role);
    collection.push(end_role);
  }
  let count = 0;
  collection.map(role => {
    return {
      id: role.id,
      name: role.name,
      color: role.color,
      icon: role.iconURL() || "",
      members: role.members.map(member => member.id)
    };
  }).forEach(async role => {
    const key = getKey(guild.id, role.members[0])
    Roles.upsert({
      key, id: role.id
    }).then(async () => {
      CustomRoles.upsert({
        key, name: role.name, color: role.color, icon: role.icon
      }).then(async () => {
        count++;
        if (count === collection.size) {
          await interaction.reply({ content: `Successfully transfered ${count} booster roles!`, ephemeral: true });
        }
      });
    });
  });
}

module.exports = { data, execute };