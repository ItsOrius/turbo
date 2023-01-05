const Discord = require('discord.js');
const { getCustomRoleData, setCustomRoleData, getServerSettings, setMessageCache, MessageCache } = require('../databaseManager.js');
const tempUserStorage = [];

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
      content: `Hey, <@${interaction.user.id}>! You were flagged for review, but the server has no channel!\nPlease inform a staff member ASAP!`,
      ephemeral: true
    });
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
    }).catch(err => {
      interaction.channel.send({
        content: `Hey, <@${interaction.user.id}>! An error occurred while sending your role for review. Please try again later.\n\`\`\`${err}\`\`\``,
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
  if (!interaction.member.premiumSince) return interaction.reply({ content: 'You must be a server booster to use this command!', ephemeral: true });
  getCustomRoleData(interaction.guildId, interaction.user.id).then(customRole => {
    // runs if custom role exists
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
    // check if role passes checks
    passesChecks(interaction.guildId, name, submittedName, submittedIcon).then(checks => {
      if (checks.length < 1) {
        // edit custom role data- no checks necessary
        setCustomRoleData(client, {name, color, icon}, interaction.guildId, interaction.user.id).then(() => {
          interaction.reply({ content: 'Custom role updated!', ephemeral: true });
        }).catch((err) => {
          interaction.reply({ content: 'An error occurred while updating your custom role!', ephemeral: true });
        });
        return;
      }
      // runs if role doesn't pass every check
      if (checks.includes(CHECKS.ALPHANUMERIC)) {
        // runs when role name is not alphanumeric
        interaction.reply({ embeds: [quickEmbed("Invalid Name", CHECKS.ALPHANUMERIC, Discord.Colors.Red)], ephemeral: true });
        return;
      }
      if (checks.includes(CHECKS.UNSUPPORTED_NAME)) {
        // runs when role name is not supported
        interaction.reply({ embeds: [quickEmbed("Invalid Name", CHECKS.UNSUPPORTED_NAME, Discord.Colors.Red)], ephemeral: true });
        return;
      }
      if (checks.includes(CHECKS.UNSUPPORTED_ICON)) {
        // runs when role icon is not supported
        interaction.reply({ embeds: [quickEmbed("Invalid Icon", CHECKS.UNSUPPORTED_ICON, Discord.Colors.Red)], ephemeral: true });
        return;
      }
      // skips if user is already in temp storage
      if (tempUserStorage.includes(interaction.user.id)) {
        interaction.reply({ embeds: [
          quickEmbed("Woah, slow down!", "You already sent a role request requiring review in the past 15 minutes.\nPlease try again later!")
        ], ephemeral: true });
        return;
      }
      // send review embed to review channel
      createReviewMessage(interaction, name, color, icon);
      // runs if role needs to be reviewed
      interaction.reply({ embeds: [
        quickEmbed("Review", "Your updated role is being reviewed.\nPlease be patient while a moderator checks your role!", Discord.Colors.Yellow)
      ], ephemeral: true }).catch(err => {
        if (interaction.replied) return;
        interaction.reply({ content: "Your updated role is being reviewed.\nPlease be patient while a moderator checks your role!", ephemeral: true });  
      });
    }).catch(err => {
      console.error(err);
    });
  }).catch(() => {
    // runs if custom role doesn't exist
    // check that options are valid and accounted for
    if (!name) return interaction.reply({ content: 'You must provide a name for your role!', ephemeral: true });
    if (!/^#[0-9A-Fa-f]{6}$/i.test(color)) return interaction.reply({ content: 'Invalid color!', ephemeral: true });
    if (!icon || icon.toLowerCase() == 'none') icon = "";
    // check if role passes checks
    passesChecks(interaction.guildId, name, submittedName, submittedIcon).then(checks => {
      if (checks.length < 1) {
        // set custom role data- no checks necessary
        setCustomRoleData(client, {name, color, icon}, interaction.guildId, interaction.user.id).then(() => {
          interaction.reply({ content: 'Custom role created!', ephemeral: true });
        }).catch(() => {
          interaction.reply({ content: 'An error occurred while creating your custom role!', ephemeral: true });
        });
        return;
      }
      // runs if role doesn't pass every check
      if (checks.includes(CHECKS.NAMES_DISABLED)) {
        // runs when role names are disabled
        interaction.reply({ embeds: [quickEmbed("Invalid Input", CHECKS.NAMES_DISABLED, Discord.Colors.Red)], ephemeral: true });
        return;
      }
      if (checks.includes(CHECKS.ICONS_DISABLED)) {
        // runs when role icons are disabled
        interaction.reply({ embeds: [quickEmbed("Invalid Input", CHECKS.ICONS_DISABLED, Discord.Colors.Red)], ephemeral: true });
        return;
      }
      if (checks.includes(CHECKS.ALPHANUMERIC)) {
        // runs when role name is not alphanumeric
        interaction.reply({ embeds: [quickEmbed("Invalid Name", CHECKS.ALPHANUMERIC, Discord.Colors.Red)], ephemeral: true });
        return;
      }
      if (checks.includes(CHECKS.UNSUPPORTED_NAME)) {
        // runs when role name is not supported
        interaction.reply({ embeds: [quickEmbed("Invalid Name", CHECKS.UNSUPPORTED_NAME, Discord.Colors.Red)], ephemeral: true });
        return;
      }
      if (checks.includes(CHECKS.UNSUPPORTED_ICON)) {
        // runs when role icon is not supported
        interaction.reply({ embeds: [quickEmbed("Invalid Icon", CHECKS.UNSUPPORTED_ICON, Discord.Colors.Red)], ephemeral: true });
        return;
      }
      // skips if user is already in temp storage
      if (tempUserStorage.includes(interaction.user.id)) {
        interaction.reply({ embeds: [
          quickEmbed("Woah, slow down!", "You already sent a role request requiring review in the past 15 minutes.\nPlease try again later!")
        ], ephemeral: true });
        return;
      }
      // send review embed to review channel
      createReviewMessage(interaction, name, color, icon);
      // add user to temp storage
      tempUserStorage.push(interaction.user.id);
      // runs if role needs to be reviewed
      interaction.reply({ embeds: [
        quickEmbed("Review", "Your new role is being reviewed.\nPlease be patient while a moderator checks your role!", Discord.Colors.Yellow)
      ], ephemeral: true }).catch(err => {
        if (interaction.replied) return;
        interaction.reply({ content: "Your updated role is being reviewed.\nPlease be patient while a moderator checks your role!", ephemeral: true });
      });
    }).catch(() => {
      interaction.reply({ content: 'An error occurred while checking your role!', ephemeral: true });
    });
  });
}

module.exports = { data, execute };