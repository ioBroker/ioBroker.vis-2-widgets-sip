/*!
 * ioBroker gulpfile
 * Date: 2023-02-22
 */
'use strict';

const adapterName = require('./package.json').name.replace('iobroker.', '');
const buildHelper = require('@iobroker/vis-2-widgets-react-dev/buildHelper');
const { deleteFoldersRecursive, npmInstall, copyFiles } = require('@iobroker/build-tools');
const { existsSync, readdirSync, rmdirSync } = require('node:fs');

function cleanWidget() {
    deleteFoldersRecursive(`${__dirname}/src-widgets/build`);
    deleteFoldersRecursive(`${__dirname}/widgets`);
}

function copyAllFilesWidget() {
    deleteFoldersRecursive(`${__dirname}/widgets`);
    copyFiles([`src-widgets/build/*.js`], `widgets/${adapterName}`);
    copyFiles([`src-widgets/build/img/*`], `widgets/${adapterName}/img`);
    copyFiles([`src-widgets/build/*.map`], `widgets/${adapterName}`);

    let files = [`src-widgets/build/static/**/*`, ...buildHelper.ignoreFiles(`src-widgets/`)];
    copyFiles(files, `widgets/${adapterName}/static`);
    copyFiles(
        [
            'src-widgets/build/static/js/*react-transition-group_esm*',
            'src-widgets/build/static/js/*mui_system_colorManipulator*',
        ],
        `widgets/${adapterName}/static/js`,
    );

    copyFiles(
        [
            'src-widgets/build/static/js/*mui_material_styles_styled_js-node_modules_mui_material_styles_useTheme*.*',
            'src-widgets/build/static/js/*mui_material_styles_useTheme_js-node_modules*.*',
            'src-widgets/build/static/js/*mui_material_Button_Button_js-node_modules_mui_material_DialogActions*.*',
            'src-widgets/build/static/js/*mui_material_Button_Button_js-node_modules_mui_material_Chip_Chip_*.*',
            'src-widgets/build/static/js/*mui_material_Button_Button_js-node_modules_mui_material_Dialog_Dialog_*.*',
            'src-widgets/build/static/js/*mui_styled-engine_index_js-node_modules_mui_system_esm_*.*',
            'src-widgets/build/static/js/*mui_material_styles_styled_*.*',
            'src-widgets/build/static/js/*mui_x-date-pickers_TimePicker_TimePicker*.*',
            'src-widgets/build/static/js/*mui_x-date-pickers_AdapterMoment*.*',
            'src-widgets/build/static/js/*react-transition-group_esm_CSSTransition*.*',
            'src-widgets/build/static/js/*mui_material_utils_createSvgIcon*.*',
            'src-widgets/build/static/js/*suncalc2_suncalc2*.*',
            `src-widgets/build/static/js/*jssip_lib*.*`,
            `src-widgets/build/static/js/*ace_lib*.*`,
            ...buildHelper.copyFiles(`src-widgets/`),
        ],
        `widgets/${adapterName}/static/js`,
    );

    copyFiles([`src-widgets/src/i18n/*.json`], `widgets/${adapterName}/i18n`);

    return new Promise(resolve =>
        setTimeout(() => {
            if (
                existsSync(`widgets/${adapterName}/static/media`) &&
                !readdirSync(`widgets/${adapterName}/static/media`).length
            ) {
                rmdirSync(`widgets/${adapterName}/static/media`);
            }
            resolve(null);
        }, 500),
    );
}

if (process.argv.find(arg => arg.includes('--widgets-copy'))) {
    copyAllFilesWidget().catch(e => {
        console.error('Cannot copy files: ' + e);
        process.exit(10);
    });
} else {
    cleanWidget();
    const npmPromise = existsSync(`${__dirname}/src-widgets/node_modules`)
        ? Promise.resolve()
        : npmInstall(`${__dirname}/src-widgets/`);

    npmPromise
        .then(() => buildHelper.buildWidgets(__dirname, `${__dirname}/src-widgets/`))
        .then(() => copyAllFilesWidget());
}
