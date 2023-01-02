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
  // fetch every member of the guild
  await guild.members.fetch();
  // get array of every role between the start and end roles, unless inclusive is true
  const max = inclusive ? start_role.position + 1 : start_role.position
  const min = inclusive ? end_role.position - 1 : end_role.position;
  const collection = guild.roles.cache.filter(role => {
    return role.position < max && role.position > min;
  });
  if (!collection) {
    await interaction.reply({ content: "There are no roles between the start and end roles!", ephemeral: true });
    return;
  }
  if (collection.size === 0) {
    await interaction.reply({ content: "There are no roles between the start and end roles!", ephemeral: true });
    return;
  }
  // send "please wait" message and then edit it when done
  await interaction.reply({ content: `Beginning transfer of ${collection.size} roles... this may take a while!`, ephemeral: true });
  console.log(`Beginning transfer of ${collection.size} roles for ${guild.name} (${guild.id})...`);
  let count = 0;
  let failedCount = 0;
  collection.forEach(async role => {
    const member = role.members.first();
    if (!member) {
      failedCount++;
      console.log(`Skipping role ${role.name} (${role.id}) for ${guild.name} (${guild.id}) because it has no members!\nCurrent count: ${count + failedCount}/${collection.size}`);
      if (count + failedCount >= collection.size) {
        await interaction.editReply({ content: `Successfully transfered ${count} booster roles with ${failedCount} empty roles.` });
      }
      return;
    }
    const key = getKey(guild.id, member.id);
    Roles.upsert({
      key, id: role.id
    }).then(async () => {
      CustomRoles.upsert({
        key, name: role.name, color: role.color, icon: role.icon ?? ""
      }).then(async () => {
        count++;
        console.log(
          `Transferring role ${role.name} (${role.id}) for ${guild.name} (${guild.id}) and user with ID of ${member.id}...\nCurrent count: ${count + failedCount}/${collection.size}`
        );
        if (count + failedCount >= collection.size) {
          await interaction.editReply({ content: `Successfully transfered ${count} booster roles with ${failedCount} empty roles.` });
        }
      });
    });
  });
}

module.exports = { data, execute };