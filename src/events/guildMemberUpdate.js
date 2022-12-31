const Discord = require('discord.js');
const { getCustomRoleData, setCustomRoleData } = require('../databaseManager.js');

/**
 * @param {Discord.Client} client
 * @param {Discord.GuildMember} oldMember
 * @param {Discord.GuildMember} newMember
 */
function execute(client, oldMember, newMember) {
  const oldDate = oldMember.premiumSince;
  const newDate = newMember.premiumSince;
  if (oldDate && !newDate) {
    // user lost boost, delete custom role
    getCustomRoleData(newMember.guild.id, newMember.id).then(customRole => {
      if (customRole.id) {
        newMember.guild.roles.fetch(customRole.id).then(role => {
          role.delete();
        });
      }
    });
  } else if (!oldDate && newDate) {
    // user gained boost
    getCustomRoleData(newMember.guild.id, newMember.id).then(customRole => {
      // find role by id
      newMember.guild.roles.fetch(customRole.id).then(role => {
        // update role
        role.edit({ name: customRole.name, color: customRole.color, icon: customRole.icon });
      }).catch(() => {
        // role not found, create role
        setCustomRoleData(client, customRole, newMember.guild.id, newMember.id);
      });
    });
  }
}

module.exports = execute;