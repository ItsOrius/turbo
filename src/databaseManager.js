const Discord = require('discord.js');
const { Sequelize } = require('sequelize');
const { iconBoostRequirement } = require('./config.json');

const sequelize = new Sequelize({
  host: 'localhost',
  dialect: 'sqlite',
  storage: './database.db',
  logging: false
});

/* define models */
const CustomRoles = sequelize.define('customRoles', {
  key: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false
  },
  color: {
    type: Sequelize.STRING,
    allowNull: false
  },
  icon: {
    type: Sequelize.STRING,
    allowNull: false
  }
});
const Roles = sequelize.define('roles', {
  key: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  id: {
    type: Sequelize.STRING,
    allowNull: false
  }
});
const ServerSettings = sequelize.define('serverSettings', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  icons_setting: {
    type: Sequelize.NUMBER,
    allowNull: false,
    defaultValue: 0
  },
  colors_setting: {
    type: Sequelize.NUMBER,
    allowNull: false,
    defaultValue: 0
  },
  alphanumeric_only: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  icons_options: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: '{"None":"NONE"}'
  },
  colors_options: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: '{"None":"#000000"}'
  },
  approval_setting: {
    type: Sequelize.NUMBER,
    allowNull: false,
    defaultValue: 0
  },
  approval_channel: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: ""
  }
});

/**
 * @param {Discord.Guild} guild 
 * @param {string} name 
 * @param {string} color 
 * @param {string} icon 
 * @param {Discord.GuildMember} member
 * @returns {Promise<Discord.Role>}
 */
function createBoosterRole(guild, name, color, icon, member) {
  return new Promise((resolve, reject) => {
    guild.roles.create({
      name, color, hoist: false, mentionable: false
    }).then(role => {
      // set role icon if provided
      if (icon && guild.premiumSubscriptionCount >= iconBoostRequirement) {
        // use in try statement in case icon is invalid or server isn't boosted enough
        try {
          role.setIcon(icon);
        } catch (error) {
          console.log("Couldn't set role icon while creating role: " + err);
        }
      }
      // set role position to be one above the guild's premium subscriber role
      const premiumSubscriberRole = guild.roles.premiumSubscriberRole;
      if (premiumSubscriberRole) {
        role.setPosition(premiumSubscriberRole.position);
      }
      // add role to user
      member.roles.add(role);
      resolve(role);
    }).catch(reject);
  });
}

/**
 * @param {string} guildId 
 * @param {string} userId 
 * @returns {string}
 */
function getKey(guildId, userId) {
  return `${guildId}-${userId}`;
}

/**
 * @param {string} guildId 
 * @param {string} userId
 */
function getCustomRoleData(guildId, userId) {
  // return promise with custom role name, color, icon, and role id with as few nests as possible
  return new Promise((resolve, reject) => {
    CustomRoles.findOne({
      where: {
        key: getKey(guildId, userId)
      }
    }).then(customRole => {
      if (!customRole) return reject();
      Roles.findOne({
        where: {
          key: getKey(guildId, userId)
        }
      }).then(role => {
        if (!role) {
          role = { id: null };
        };
        return resolve({
          name: customRole.name,
          color: customRole.color,
          icon: customRole.icon,
          id: role.id
        });
      }).catch(reject);
    }).catch(reject);
  });
}

/**
 * 
 * @param {Discord.Client} client 
 * @param {object} customRole 
 * @param {string} guildId 
 * @param {string} userId 
 * @returns 
 */
function setCustomRoleData(client, customRole, guildId, userId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return reject();
  // return promise with custom role name, color, icon, and role id with as few nests as possible
  return new Promise((resolve, reject) => {
    CustomRoles.upsert({
      key: getKey(guildId, userId),
      name: customRole.name,
      color: customRole.color,
      icon: customRole.icon
    }).then(() => {
      Roles.findOne({
        where: {
          key: getKey(guildId, userId)
        }
      }).then(role => {
        // check if role with same id exists in server with id of guildId
        // if it does, update the role with the new data
        // if it doesn't, create a new role with the new data
        // then update the role id in the database
        let guildRole = guild.roles.cache.get(role.id);
        if (guildRole) {
          guildRole.edit({
            name: customRole.name,
            color: customRole.color
          }).then(() => {
            // set role icon in try statement in case the server isn't boosted enough
            if (customRole.icon && guild.premiumSubscriptionCount >= iconBoostRequirement) {
              try {
                guildRole.setIcon(customRole.icon);
              } catch (error) {
                console.log("Couldn't set role icon while updating role: " + err);
              }
            }
            return resolve();
          }).catch(reject);
        } else {
          createBoosterRole(guild, customRole.name, customRole.color, customRole.icon, guild.members.cache.get(userId)).then(newRole => {
            Roles.upsert({
              key: getKey(guildId, userId),
              id: newRole.id
            }).then(() => {
              return resolve();
            }).catch(reject);
          }).catch(reject);
        }
      }).catch(() => {
        createBoosterRole(guild, customRole.name, customRole.color, customRole.icon, guild.members.cache.get(userId)).then(newRole => {
          Roles.upsert({
            key: getKey(guildId, userId),
            id: newRole.id
          }).then(() => {
            return resolve();
          }).catch(reject);
        }).catch(reject);
      });
    }).catch(() => { reject("Failed to upsert custom role!") });
  });
}

module.exports = { CustomRoles, Roles, ServerSettings, sequelize, getCustomRoleData, setCustomRoleData };