const Discord = require('discord.js');
const probe = require('probe-image-size');
const { getCustomRoleData, setCustomRoleData, getServerSettings, setMessageCache, MessageCache, usedIds } = require('../databaseManager.js');

const CHECKS = {
  ALPHANUMERIC: 'Your role name must only contain alphanumeric characters (0-9, A-Z, a-z, and spaces).',
  UNSUPPORTED_NAME: 'Your role name is unsupported. Please try a different name.',
  UNSUPPORTED_ICON: 'Your role icon is unsupported. Please try a different icon.',
  REVIEW_NAME: 'Name',
  REVIEW_ICON: 'Icon',
  NAMES_DISABLED: 'Custom role names are disabled on this server.',
  ICONS_DISABLED: 'Custom role icons are disabled on this server.'
}

const data = new Discord.SlashCommandBuilder()
  .setName('customrole')
  .setDescription('Create a custom role for yourself!')
  .addStringOption(option => option.setName('name').setDescription('The name of your role.'))
  .addStringOption(option => option.setName('color').setDescription('The hexadecimal color of your role. For example, #00CCFF.').setMinLength(7).setMaxLength(7))
  .addStringOption(option => option.setName('icon').setDescription('A URL for the icon of the role. Type "NONE" to remove it.'));



/**
 * @param {string} guildId 
 * @param {string} roleName 
 * @param {boolean} submittedName
 * @param {boolean} submittedIcon
 * @returns {string[]}
 */
function passesChecks(guildId, roleName, submittedName, submittedIcon) {
  return new Promise((resolve, reject) => {
    getServerSettings(guildId).then(serverSettings => {
      const checks = [];
      if (serverSettings.alphanumericOnly && submittedName) {
        if (!/^[a-zA-Z0-9 ]+$/.test(roleName)) checks.push(CHECKS.ALPHANUMERIC);
      }
      if (serverSettings.nameSetting == 1 && !Object.values(serverSettings.nameOptions).includes(roleName)) checks.push(CHECKS.UNSUPPORTED_NAME);
      if (serverSettings.iconSetting == 1 && !Object.values(serverSettings.iconsOptions).includes(roleIcon)) checks.push(CHECKS.UNSUPPORTED_ICON);
      if (serverSettings.nameSetting == 2 && submittedName) checks.push(CHECKS.REVIEW_NAME);
      if (serverSettings.iconSetting == 2 && submittedIcon) checks.push(CHECKS.REVIEW_ICON);
      if (serverSettings.nameSetting == 3 && submittedName) checks.push(CHECKS.NAMES_DISABLED);
      if (serverSettings.iconSetting == 3 && submittedIcon) checks.push(CHECKS.ICONS_DISABLED);
      return resolve(checks);
    }).catch(reject);
  });
}



/**
 * @param {string} name 
 * @param {string} description 
 * @param {string} color 
 * @returns {Discord.EmbedBuilder}
 */
function quickEmbed(name, description, color) {
  return new Discord.EmbedBuilder()
    .setTitle(name)
    .setDescription(description)
    .setColor(color);
}



/**
 * @param {Discord.CommandInteraction} interaction
 * @param {string} roleName
 * @param {string} roleColor
 * @param {string} roleIcon
 */
function createReviewMessage(interaction, roleName, roleColor, roleIcon) {
  const embed = quickEmbed('Custom Role Review', `A custom role has been requested by <@${interaction.user.id}>.`, roleColor);
  if (roleName) embed.addFields([{ name: "Name", value: roleName }]);
  if (roleIcon) {
    embed.setImage(roleIcon);
    embed.addFields([
      { name: "Icon", value: "The requested icon is shown below." },
    ]);
  }
  getServerSettings(interaction.guildId).then(serverSettings => {
    // make sure review channel exists
    const reviewChannel = interaction.guild.channels.cache.get(serverSettings.approvalChannel);
    if (!reviewChannel) return interaction.channel.send({
      embeds: [
        quickEmbed("Error", `You were flagged for review, but this server has no review channel!\nPlease inform a staff member ASAP!`, Discord.Colors.Red)
      ],
      ephemeral: true
    }).catch(() => {});
    // send review message with embed and buttons
    reviewChannel.send({embeds: [embed], components: [
      new Discord.ActionRowBuilder()
        .addComponents(
          new Discord.ButtonBuilder()
            .setCustomId('approve')
            .setLabel('Approve')
            .setStyle(Discord.ButtonStyle.Success),
          new Discord.ButtonBuilder()
            .setCustomId('deny')
            .setLabel('Deny')
            .setStyle(Discord.ButtonStyle.Danger)
        )
    ]}).then(message => {
      // add message to database
      const json = {
        roleName, roleColor, roleIcon, userId: interaction.user.id
      }
      setMessageCache(new MessageCache(message.id, 0, JSON.stringify(json))).then(() => {}).catch(console.error);
      usedIds.push(interaction.guildId + "-" +  interaction.user.id);
    }).catch(err => {
      interaction.channel.send({
        embeds: quickEmbed("Error", `An error occurred while sending your role for review. Please try again later.\n\`\`\`${err}\`\`\``, Discord.Colors.Red),
        ephemeral: true
      }).then(() => {}).catch((err) => {
        console.log(`Error sending error message to ${interaction.user.id}:\n${err}`);
      });
    });
  }).catch(err => {
    console.error(err);
  });
}



/**
 * @param {Discord.Client} client 
 * @param {Discord.CommandInteraction} interaction 
 */
function execute(client, interaction) {
  let name = interaction.options.getString('name');
  const submittedName = name;
  let color = interaction.options.getString('color');
  let icon = interaction.options.getString('icon');
  const submittedIcon = (!icon || icon.toLowerCase() == 'none') ? false : true;
  if (!interaction.member.premiumSince) return interaction.reply({ embeds: [
    quickEmbed("Access Denied", 'You must be a server booster to use this command!', Discord.Colors.Red)
  ], ephemeral: true }).catch(() => {});
  if (usedIds.includes(interaction.guildId + "-" + interaction.user.id)) return interaction.reply({ embeds: [
    quickEmbed("Woah there, slow down!", "You're already waiting for a review!", Discord.Colors.Red)
  ], ephemeral: true }).catch(() => {});
  getCustomRoleData(interaction.guildId, interaction.user.id).then(customRole => {
    // runs if custom role exists
    const role = interaction.guild.roles.cache.get(customRole.id);
    if (!name && !color && !icon) return interaction.reply({ embeds: [
      quickEmbed("Role Information", `Your personal role is <@&${role.id}>.`, role.hexColor).setImage(customRole.icon)
    ], ephemeral: true }).catch(() => {});
    if (!name) name = role.name ?? "new role";
    if (!color) color = role.hexColor ?? "#000000";
    if (!icon) {
      icon = customRole.icon ?? "";
    }
    if (icon.toLowerCase() == 'none') {
      icon = "";
      role.edit({ icon: null });
    };
    // check if role passes checks
    passesChecks(interaction.guildId, name, submittedName, submittedIcon).then(checks => {
      if (checks.length < 1) {
        // edit custom role data- no checks necessary
        setCustomRoleData(client, {name, color, icon}, interaction.guildId, interaction.user.id).then((role) => {
          interaction.reply({ embeds: [
            quickEmbed("Success", `Your custom role, <@&${role.id}>, has been updated!`, Discord.Colors.Green)
          ], ephemeral: true }).catch(() => {});
        }).catch((err) => {
          interaction.reply({ embeds: [
            quickEmbed("Error", `An error occurred while updating your role. Please try again later.\n\`\`\`${err}\`\`\``, Discord.Colors.Red)
          ], ephemeral: true }).catch(() => {});
        });
        return;
      }
      // runs if role doesn't pass every check
      if (checks.includes(CHECKS.NAMES_DISABLED)) {
        // runs when role names are disabled
        interaction.reply({ embeds: [quickEmbed("Invalid Input", CHECKS.NAMES_DISABLED, Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      if (checks.includes(CHECKS.ICONS_DISABLED)) {
        // runs when role icons are disabled
        interaction.reply({ embeds: [quickEmbed("Invalid Input", CHECKS.ICONS_DISABLED, Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      if (checks.includes(CHECKS.ALPHANUMERIC)) {
        // runs when role name is not alphanumeric
        interaction.reply({ embeds: [quickEmbed("Invalid Name", CHECKS.ALPHANUMERIC, Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      if (checks.includes(CHECKS.UNSUPPORTED_NAME)) {
        // runs when role name is not supported
        interaction.reply({ embeds: [quickEmbed("Invalid Name", CHECKS.UNSUPPORTED_NAME, Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      if (checks.includes(CHECKS.UNSUPPORTED_ICON)) {
        // runs when role icon is not supported
        interaction.reply({ embeds: [quickEmbed("Invalid Icon", CHECKS.UNSUPPORTED_ICON, Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      // check if icon (variable is a image url, find IMAGE size) is more than 2048 kilobytes
      let downloadedIcon = probe.sync(icon);
      if (icon && (downloadedIcon.length > 2048000 || !downloadedIcon)) {
        // runs if icon is too large
        interaction.reply({ embeds: [quickEmbed("Invalid Icon", "Please use a valid role icon that is under 2048 kilobytes in size!", Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      // send review embed to review channel
      createReviewMessage(interaction, name, color, icon);
      // runs if role needs to be reviewed
      interaction.reply({ embeds: [
        quickEmbed("Review", "Your updated role is being reviewed.\nPlease be patient while a moderator checks your role!", Discord.Colors.Yellow)
      ], ephemeral: true }).catch(err => {
        // if (interaction.replied) return;
      });
    }).catch(err => {
      console.error(err);
    });
  }).catch(() => {
    // runs if custom role doesn't exist
    // check that options are valid and accounted for
    if (!name) return interaction.reply({ embeds: [
      quickEmbed("Invalid Input", "Please provide a valid role name!", Discord.Colors.Red)
    ], ephemeral: true }).catch(() => {});
    if (!/^#[0-9A-Fa-f]{6}$/i.test(color)) return interaction.reply({ embeds: [
      quickEmbed("Invalid Input", "Please provide a valid hexadecimal role color!\nFor example, ``#00CCFF``.", Discord.Colors.Red)
    ], ephemeral: true }).catch(() => {});
    if (!icon || icon.toLowerCase() == 'none') icon = "";
    // check if role passes checks
    passesChecks(interaction.guildId, name, submittedName, submittedIcon).then(checks => {
      if (checks.length < 1) {
        // set custom role data- no checks necessary
        setCustomRoleData(client, {name, color, icon}, interaction.guildId, interaction.user.id).then((role) => {
          interaction.reply({ embeds: [
            quickEmbed("Success", `Your custom role, <@&${role.id}>, has been created!`, Discord.Colors.Green)
          ], ephemeral: true }).catch(() => {});
        }).catch((err) => {
          interaction.reply({ embeds: [
            quickEmbed("Error", `An error occurred while creating your role. Please try again later.\n\`\`\`${err}\`\`\``, Discord.Colors.Red)
          ], ephemeral: true }).catch(() => {});
        });
        return;
      }
      // runs if role doesn't pass every check
      if (checks.includes(CHECKS.NAMES_DISABLED)) {
        // runs when role names are disabled
        interaction.reply({ embeds: [quickEmbed("Invalid Input", CHECKS.NAMES_DISABLED, Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      if (checks.includes(CHECKS.ICONS_DISABLED)) {
        // runs when role icons are disabled
        interaction.reply({ embeds: [quickEmbed("Invalid Input", CHECKS.ICONS_DISABLED, Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      if (checks.includes(CHECKS.ALPHANUMERIC)) {
        // runs when role name is not alphanumeric
        interaction.reply({ embeds: [quickEmbed("Invalid Name", CHECKS.ALPHANUMERIC, Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      if (checks.includes(CHECKS.UNSUPPORTED_NAME)) {
        // runs when role name is not supported
        interaction.reply({ embeds: [quickEmbed("Invalid Name", CHECKS.UNSUPPORTED_NAME, Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      if (checks.includes(CHECKS.UNSUPPORTED_ICON)) {
        // runs when role icon is not supported
        interaction.reply({ embeds: [quickEmbed("Invalid Icon", CHECKS.UNSUPPORTED_ICON, Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      // check if icon (variable is a image url, find IMAGE size) is more than 2048 kilobytes
      let downloadedIcon = probe.sync(icon);
      if (icon && (downloadedIcon.length > 2048000 || !downloadedIcon)) {
        // runs if icon is too large
        interaction.reply({ embeds: [quickEmbed("Invalid Icon", "Please use a valid role icon that is under 2048 kilobytes in size!", Discord.Colors.Red)], ephemeral: true }).catch(() => {});
        return;
      }
      // send review embed to review channel
      createReviewMessage(interaction, name, color, icon);
      // runs if role needs to be reviewed
      interaction.reply({ embeds: [
        quickEmbed("Submitted", "Your new role is being reviewed.\nPlease be patient while a moderator checks your role!", Discord.Colors.Yellow)
      ], ephemeral: true }).catch(err => {
        // if (interaction.replied) return;
      });
    }).catch(err => {
      interaction.reply({ embeds: [quickEmbed("Error", "An error occured while checking your role!", Discord.Colors.Red)], ephemeral: true }).catch(() => {});
    });
  });
}

module.exports = { data, execute };