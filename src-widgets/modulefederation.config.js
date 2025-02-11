const makeFederation = require('@iobroker/vis-2-widgets-react-dev/modulefederation.config');

module.exports = makeFederation('vis2Sip', {
    './Sip': './src/Sip',
    './translations': './src/translations',
});
