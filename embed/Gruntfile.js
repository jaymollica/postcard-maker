const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    'string-replace': {
      replaceUrls: {
        files: {
          'ollie.js': 'ollieSrc.js',
        },
        options: {
          replacements: [
            {
              pattern: /__BACKEND_URL__/g,
              replacement: process.env.BACKEND_URL,
            },
            {
              pattern: /__FRONTEND_ORIGIN__/g,
              replacement: process.env.FRONTEND_ORIGIN,
            },
          ],
        },
      },
    },
    uglify: {
        minifyJs: {
            files: {
                'ollie.js': ['ollie.js'],
            },
        },
    },
    watch: {
      files: ['ollieSrc.js'],
      tasks: ['string-replace', 'uglify'],
    },
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-string-replace');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.registerTask('dev', ['string-replace',
//   'uglify',
  'watch']);
  grunt.registerTask('build', ['string-replace'
//   ,
//   'uglify'
]);
};