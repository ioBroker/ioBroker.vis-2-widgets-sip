/*!
 * ioBroker gulpfile
 * Date: 2023-02-22
 */
'use strict';

const gulp = require('gulp');
const adapterName = require('./package.json').name.replace('iobroker.', '');
const gulpHelper = require('@iobroker/vis-2-widgets-react-dev/gulpHelper');

// http://127.0.0.1:18082/vis-2-beta/widgets/vis-2-widgets-material/static/js/node_modules_iobroker_vis-2-widgets-react-dev_index_jsx-_adb40.af309310.chunk.js

gulpHelper.gulpTasks(gulp, adapterName, __dirname, `${__dirname}/src-widgets/`, [
    `${__dirname}/src-widgets/build/static/js/*jssip_lib*.*`,
    `${__dirname}/src-widgets/build/static/js/*ace_lib*.*`,
]);

gulp.task('default', gulp.series('widget-build'));
