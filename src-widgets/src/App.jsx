import React from 'react';
import { withStyles } from '@mui/styles';

import WidgetDemoApp from '@iobroker/vis-2-widgets-react-dev/widgetDemoApp';
import { I18n } from '@iobroker/adapter-react-v5';

import { Checkbox, TextField } from '@mui/material';
import Sip from './Sip';
import translations from './translations';

const styles = theme => ({
    app: {
        backgroundColor: theme?.palette?.background.default,
        color: theme?.palette?.text.primary,
        height: '100%',
        width: '100%',
        overflow: 'auto',
        display: 'flex',
    },
});

class App extends WidgetDemoApp {
    constructor(props) {
        super(props);

        this.state.disabled = JSON.parse(window.localStorage.getItem('disabled')) || {};

        this.state.data3d = JSON.parse(window.localStorage.getItem('data3d')) || {
            items: [],
        };

        this.state.values = {
            server: window.localStorage.getItem('server') || '',
            user: window.localStorage.getItem('user') || '',
            password: window.localStorage.getItem('password') || '',
        };

        // init translations
        I18n.extendTranslations(translations);

        this.socket.registerConnectionHandler(this.onConnectionChanged);
    }

    onConnectionChanged = isConnected => {
        if (isConnected) {
            this.socket.getSystemConfig()
                .then(systemConfig => this.setState({ systemConfig }));
        }
    };

    renderWidget() {
        const widgets = {
            sip: <Sip
                key="Actual"
                context={{
                    socket: this.socket,
                    systemConfig: this.state.systemConfig,
                }}
                themeType={this.state.themeType}
                style={{
                    width: 800,
                    height: 600,
                }}
                onChangeSettings={data3d => {
                    this.setState({ data3d });
                    window.localStorage.setItem('data3d', JSON.stringify(data3d));
                }}
                data={{
                    name: 'Actual temperature',
                    server: this.state.values.server,
                    user: this.state.values.user,
                    password: this.state.values.password,
                    camera: 'cam1',
                    // dialog: true,
                }}
                fake
            />,
        };

        return <div className={this.props.classes.app}>
            <div>
                {Object.keys(widgets).map(key => <div key={key} style={{ display: 'flex', alignItems: 'center' }}>
                    <Checkbox
                        checked={!this.state.disabled[key]}
                        onChange={e => {
                            const disabled = JSON.parse(JSON.stringify(this.state.disabled));
                            disabled[key] = !e.target.checked;
                            window.localStorage.setItem('disabled', JSON.stringify(disabled));
                            this.setState({ disabled });
                        }}
                    />
                    {key}
                </div>)}
                {['server', 'user', 'password'].map(key => <TextField
                    key={key}
                    label={key}
                    value={this.state.values[key]}
                    onChange={e => {
                        this.setState({ values: { ...this.state.values, [key]: e.target.value } });
                        window.localStorage.setItem(key, e.target.value);
                    }}
                />)}
            </div>
            {Object.keys(widgets).map(key => (this.state.disabled[key] ? null : widgets[key]))}
        </div>;
    }
}

export default withStyles(styles)(App);
