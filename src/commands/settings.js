const Discord = require('discord.js');
const { getServerSettings, setServerSettings } = require("../databaseManager.js");

const data = new Discord.SlashCommandBuilder()
  .setName('settings')
  .setDescription('Change the settings for the server.')
  .addSubcommand(subcommand => {
    return subcommand.setName('alphanumeric')
      .setDescription('Set whether or not to allow non-alphanumeric characters in custom role names.')
      .addBooleanOption(option => {
        return option.setName('value')
          .setDescription('Should users be allowed to use non-alphanumeric characters in their custom role names?')
          .setRequired(true);
      })
  })
  .addSubcommand(subcommand => {
    return subcommand.setName('color')
      .setDescription('Set how boosters customize their role color.')
      .addNumberOption(option => {
        return option.setName('option')
          .setDescription('The mode to set the option to.')
          .setChoices(
            { name: "Always Allow", value: 0 },
            { name: "From Selection", value: 1 },
            { name: "Never Allow", value: 2 }
          )
          .setRequired(true);
      })
  })
  .addSubcommand(subcommand => {
    return subcommand.setName('icon')
      .setDescription('Set how boosters customize their role icon.')
      .addNumberOption(option => {
        return option.setName('option')
          .setDescription('The mode to set the option to.')
          .setChoices(
            { name: "Always Allow", value: 0 },
            { name: "From Selection", value: 1 },
            { name: "Require Approval", value: 2 },
            { name: "Never Allow", value: 3 }
          )
          .setRequired(true);
      })
  })
  .addSubcommand(subcommand => {
    return subcommand.setName('name')
      .setDescription('Set how boosters customize their role name.')
      .addNumberOption(option => {
        return option.setName('option')
          .setDescription('The mode to set the option to.')
          .setChoices(
            { name: "Always Allow", value: 0 },
            { name: "From Selection", value: 1 },
            { name: "Require Approval", value: 2 }
          )
          .setRequired(true);
      })
  })
  .addSubcommand(subcommand => {
    return subcommand.setName('review')
      .setDescription('Set where custom role requests are reviewed.')
      .addChannelOption(option => {
        return option.setName('channel')
          .setDescription('The channel to review requests in.')
          .addChannelTypes(Discord.ChannelType.GuildText)
          .setRequired(true);
      })
  });



/**
 * @param {Discord.Client} client 
 * @param {Discord.CommandInteraction} interaction 
 */
function execute(client, interaction) {
  if (!interaction.member.permissions.has(Discord.PermissionFlagsBits.Administrator) && !interaction.member.permissions.has(Discord.PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({ content: "You don't have permission to use this command.", ephemeral: true });
  }
  const subcommand = interaction.options.getSubcommand();
  const value = interaction.options.getBoolean('value');
  const option = interaction.options.getNumber('option');
  const channel = interaction.options.getChannel('channel');
  getServerSettings(interaction.guild.id).then(settings => {
    if (option == 2 && !settings.approvalChannel) {
      return interaction.reply({ content: "You must set a review channel before you can require approval.", ephemeral: true });
    }
    switch (subcommand) {
      case 'alphanumeric':
        settings.alphanumericOnly = !value;
        break;
      case 'color':
        settings.colorSetting = option;
        break;
      case 'icon':
        settings.iconSetting = option;
        break;
      case 'name':
        settings.nameSetting = option;
        break;
      case 'review':
        settings.approvalChannel = channel.id;
        break;
    }
    setServerSettings(interaction.guild.id, settings).then(() => {
      interaction.reply({ content: "Settings updated.", ephemeral: true });
    }).catch((err) => {
      interaction.reply({ content: "An error occurred while updating the settings.\n```" + err + "```", ephemeral: true });
    });
  }).catch((err) => {
    interaction.reply({ content: "An error occurred while getting the settings.\n```" + err + "```", ephemeral: true });
  });
}

module.exports = { data, execute };