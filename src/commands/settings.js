const Discord = require('discord.js');

const data = new Discord.SlashCommandBuilder()
  .setName('settings')
  .setDescription('Change the settings for the server.')
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
  });

/**
 * @param {Discord.Client} client 
 * @param {Discord.CommandInteraction} interaction 
 */
function execute(client, interaction) {
  interaction.reply('Pong!');
}

module.exports = { data, execute };