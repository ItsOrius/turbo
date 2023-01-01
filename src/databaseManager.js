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
const MessageCaches = sequelize.define('messageCaches', {
  key: {
    type: Sequelize.STRING,
    primaryKey: true,
    allowNull: false,
    unique: true
  },
  type: {
    type: Sequelize.NUMBER,
    allowNull: false
  },
  json: {
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
  colors_setting: {
    type: Sequelize.NUMBER,
    allowNull: false,
    defaultValue: 0
  },
  icons_setting: {
    type: Sequelize.NUMBER,
    allowNull: false,
    defaultValue: 0
  },
  name_setting: {
    type: Sequelize.NUMBER,
    allowNull: false,
    defaultValue: 0
  },
  alphanumeric_only: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  colors_options: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: '{"None":"#000000"}'
  },
  icons_options: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: '{"None":"NONE"}'
  },
  name_options: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: '{"Default":"Personal Role"}'
  },
  approval_channel: {
    type: Sequelize.STRING,
    allowNull: false,
    defaultValue: ""
  }
});



/* define classes */
class ServerOptions {
  /**
   * 
   * @param {string} serverId 
   * @param {number} colorSetting 
   * @param {number} iconSetting 
   * @param {number} nameSetting 
   * @param {boolean} alphanumericOnly 
   * @param {object} colorsOptions 
   * @param {object} iconsOptions 
   * @param {object} nameOptions 
   * @param {string} approvalChannel 
   */
  constructor(serverId, colorSetting, iconSetting, nameSetting, alphanumericOnly, colorsOptions, iconsOptions, nameOptions, approvalChannel) {
    this.serverId = serverId ?? "";
    this.colorSetting = colorSetting ?? 0;
    this.iconSetting = iconSetting ?? 0;
    this.nameSetting = nameSetting ?? 0;
    this.alphanumericOnly = alphanumericOnly ?? 0;
    this.colorsOptions = colorsOptions ?? { "None": "#000000" };
    this.iconsOptions = iconsOptions ?? { "None": "NONE" };
    this.nameOptions = nameOptions ?? { "Default": "Personal Role" };
    this.approvalChannel = approvalChannel ?? "";
  }
}
class MessageCache {
  /**
   * @param {string} key
   * @param {number} type
   * @param {string} json
   */
  constructor(key, type, json) {
    this.key = key;
    this.type = type;
    this.json = JSON.parse(json);
  }
}



/* define functions */

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
 * @returns {Promise<void>}
 */
function setCustomRoleData(client, customRole, guildId, userId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return reject("Failed to get guild!");
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

/**
 * @param {string} guildId 
 * @returns {Promise<ServerOptions>}
 */
function getServerSettings(guildId) {
  return new Promise((resolve, reject) => {
    ServerSettings.findOne({
      where: {
        id: guildId
      }
    }).then(settings => {
      if (!settings) {
        setServerSettings(guildId, new ServerOptions(guildId)).then(() => {
          return resolve(new ServerOptions(guildId));
        }).catch((err) => {
          return reject(err);
        });
      }
      return resolve(new ServerOptions(
        guildId, 
        settings.colors_setting, 
        settings.icons_setting, 
        settings.name_setting, 
        settings.alphanumeric_only, 
        JSON.parse(settings.colors_options),
        JSON.parse(settings.icons_options),
        JSON.parse(settings.name_options),
        settings.approval_channel
      ));
    }).catch((err) => {
      const options = new ServerOptions(guildId);
      setServerSettings(guildId, options).then(() => {
        return resolve(options);
      }).catch((err) => {
        return reject(err);
      });
    });
  });
}

/**
 * @param {string} guildId 
 * @param {ServerOptions} settings 
 */
function setServerSettings(guildId, settings) {
  return new Promise((resolve, reject) => {
    ServerSettings.upsert({
      id: guildId,
      color_setting: settings.colorSetting,
      icons_setting: settings.iconSetting,
      name_setting: settings.nameSetting,
      alphanumeric_only: settings.alphanumericOnly,
      colors_options: JSON.stringify(settings.colorsOptions),
      icons_options: JSON.stringify(settings.iconsOptions),
      name_options: JSON.stringify(settings.nameOptions),
      approval_channel: settings.approvalChannel
    }).then(() => {
      return resolve();
    }).catch((err) => {
      return reject();
    });
  });
}

/**
 * @param {string} messageId 
 * @returns {Promise<MessageCache>}
 */
function getMessageCache(messageId) {
  return new Promise((resolve, reject) => {
    MessageCaches.findOne({
      where: {
        key: messageId
      }
    }).then(entry => {
      if (!entry.json) return reject();
      return resolve(new MessageCache(entry.key, entry.type, entry.json));
    }).catch(reject);
  });
}

/**
 * @param {MessageCache} messageCache
 */
function setMessageCache(messageCache) {
  return new Promise((resolve, reject) => {
    MessageCaches.upsert({
      key: messageCache.key,
      type: messageCache.type,
      json: JSON.stringify(messageCache.json)
    }).then(() => {
      return resolve();
    }).catch(reject);
  });
}

module.exports = { 
  CustomRoles, 
  MessageCaches, 
  Roles, 
  ServerSettings, 
  sequelize, 
  ServerOptions, 
  MessageCache,
  getKey,
  getCustomRoleData, 
  setCustomRoleData, 
  getServerSettings, 
  setServerSettings,
  getMessageCache,
  setMessageCache
};