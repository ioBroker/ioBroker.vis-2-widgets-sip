import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';
import {
    Button, Chip, Dialog, DialogContent, Select, MenuItem, CircularProgress,
} from '@mui/material';
import { Call, CallEnd } from '@mui/icons-material';
import { WebSocketInterface, UA } from 'jssip';
import Generic from './Generic';

const styles = () => ({
    content: {
        width: '100%',
        display: 'grid',
        gridTemplateRows: 'auto min-content min-content',
        height: '100%',
    },
});

const colors = {
    connected: {
        backgroundColor: 'green',
        color: 'white',
    },
    connecting: {
        backgroundColor: 'yellow',
        color: 'black',
    },
    disconnected: {
        backgroundColor: 'red',
        color: 'white',
    },
};

const CameraField = props => {
    const [cameras, setCameras] = React.useState(null);
    const [camera, setCamera] = React.useState(props.data.camera || '');

    useEffect(() => {
        (async () => {
            const _cameras = [];
            const instances = await props.context.socket.getAdapterInstances('cameras');
            instances.forEach(instance => {
                const instanceId = instance._id.split('.').pop();
                console.log(instance.native.cameras);
                instance.native.cameras.forEach(iCamera => {
                    _cameras.push({
                        enabled: iCamera.enabled !== false,
                        value: `${instanceId}/${iCamera.name}`,
                        label: `cameras.${instanceId}/${iCamera.name}`,
                        subLabel: `${iCamera.desc}/${iCamera.ip}`,
                    });
                });
            });
            setCameras(_cameras);
        })();
    }, [props.context.socket]);

    return cameras ? <Select
        fullWidth
        variant="standard"
        value={camera}
        onChange={e => {
            props.setData({ camera: e.target.value });
            setCamera(e.target.value);
        }}
    >
        {cameras.map(iCamera => <MenuItem
            key={iCamera.value}
            value={iCamera.value}
            style={{ display: 'block', opacity: iCamera.enabled ? 1 : 0.5 }}
        >
            <div>{iCamera.label}</div>
            <div style={{ fontSize: 10, fontStyle: 'italic', opacity: 0.7 }}>{iCamera.subLabel}</div>
            {!iCamera.enabled ? <div
                style={{
                    fontSize: 10,
                    fontStyle: 'italic',
                    opacity: 0.7,
                    color: 'red',
                }}
            >
                {Generic.t('disabled')}
            </div> : null}
        </MenuItem>)}
    </Select> : <CircularProgress />;
};

class Sip extends Generic {
    divRef = React.createRef();

    sipSocket = null;

    sipUA = null;

    audio = document.createElement('audio');

    constructor(props) {
        super(props);

        this.state.peak = 0;
        this.state.status = 'idle';
        this.connectionStatus = 'disconnected';
    }

    static getWidgetInfo() {
        return {
            id: 'tplMaterial2Sip',
            visSet: 'vis-2-widgets-sip',

            visSetLabel: 'set_label', // Label of this widget set
            visSetColor: '#0783ff', // Color of this widget set

            visWidgetLabel: 'sip',  // Label of widget
            visName: 'Sip',
            visAttrs: [
                {
                    name: 'common',
                    fields: [
                        {
                            name: 'noCard',
                            label: 'without_card',
                            type: 'checkbox',
                        },
                        {
                            name: 'widgetTitle',
                            label: 'name',
                            hidden: '!!data.noCard',
                        },
                    ],
                },
                {
                    name: 'sip',
                    fields: [
                        {
                            name: 'server',
                            label: 'server',
                            tooltip: 'server_tooltip',
                            type: 'text',
                        },
                        {
                            name: 'user',
                            label: 'user',
                            tooltip: 'user_tooltip',
                            type: 'text',
                        },
                        {
                            name: 'password',
                            label: 'password',
                            type: 'password',
                        },
                        {
                            name: 'dialog',
                            label: 'dialog',
                            type: 'checkbox',
                        },
                    ],
                },
                {
                    name: 'camera',
                    fields: [
                        {
                            label: 'Camera',
                            name: 'camera',
                            type: 'custom',
                            component: (field, data, setData, props) => <CameraField
                                field={field}
                                data={data}
                                setData={setData}
                                context={props.context}
                            />,
                        },
                        {
                            name: 'pollingInterval',
                            label: 'pollingInterval',
                            tooltip: 'tooltip_ms',
                            type: 'number',
                            default: 500,
                        },
                        {
                            name: 'pollingIntervalFull',
                            label: 'pollingIntervalFull',
                            tooltip: 'tooltip_ms',
                            type: 'number',
                            default: 300,
                        },
                        {
                            name: 'noCacheByFull',
                            label: 'noCacheByFull',
                            type: 'checkbox',
                        },
                        {
                            name: 'rotate',
                            label: 'rotate',
                            type: 'select',
                            noTranslation: true,
                            options: [
                                { value: 0, label: '0°' },
                                { value: 90, label: '90°' },
                                { value: 180, label: '180°' },
                                { value: 270, label: '270°' },
                            ],
                        },
                        {
                            name: 'width',
                            label: 'videoWidth',
                            type: 'number',
                            tooltip: 'tooltip_videoWidth',
                        },
                    ],
                },
            ],
            visDefaultStyle: {
                width: '100%',
                height: 120,
                position: 'relative',
            },
            visPrev: 'widgets/vis-2-widgets-material/img/prev_actual.png',
        };
    }

    // eslint-disable-next-line class-methods-use-this
    getWidgetInfo() {
        return Sip.getWidgetInfo();
    }

    answer = session => {
        session.answer();
        this.setState({ status: 'active' });
        session.connection.onaddstream = e => {
            this.audio.srcObject = e.stream;
            this.audio.play();
            window.audio = this.audio;

            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(e.stream);
            const analyser = audioContext.createAnalyser();

            source.connect(analyser);
            analyser.connect(audioContext.destination);

            analyser.fftSize = 64;

            const frequencyData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(frequencyData);

            const update = () => {
                analyser.getByteFrequencyData(frequencyData);
                const peakFrequency = frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length;
                this.setState({ peak: peakFrequency });
            };

            const interval = setInterval(update, 100);
            session.on('ended', () => {
                clearInterval(interval);
                this.setState({ peak: 0, status: 'idle' });
            });
        };
    };

    async propertiesUpdate() {
        if (this.sipSocket) {
            this.setState({ status: 'idle', connectionStatus: 'disconnected' });
            this.sipUA.removeAllListeners();
            this.sipUA.stop();
            this.sipSocket.disconnect();
        }
        this.sipSocket = new WebSocketInterface(this.state.rxData.server);

        this.sipUA = new UA({
            sockets  : [this.sipSocket],
            uri      : this.state.rxData.user,
            password : this.state.rxData.password,
        });

        this.sipUA.on('newRTCSession', data => {
            window.data = data;
            this.setState({ status: 'ringing', session: data.session });
            console.log(data.session.connection);
        });

        this.sipUA.on('connecting', () => this.setState({ connectionStatus: 'connecting' }));
        this.sipUA.on('connected', () => this.setState({ connectionStatus: 'connected' }));
        this.sipUA.on('disconnected', () => this.setState({ connectionStatus: 'disconnected' }));

        this.sipUA.start();
    }

    async componentDidMount() {
        super.componentDidMount();
        await this.propertiesUpdate();
    }

    componentWillUnmount() {
        super.componentWillUnmount();
    }

    async onRxDataChanged() {
        await this.propertiesUpdate();
    }

    disconnect = () => {
        this.state.session.terminate();
        this.setState({ status: 'idle' });
    };

    renderContent() {
        return <div
            className={this.props.classes.content}
        >
            <div
                style={{
                    background: this.state.peak ? `radial-gradient(rgba(0, 0, ${(this.state.peak / 40) * 255}, 0.4), rgba(0,0,0,0))` : undefined,
                    transition: 'background-image 0.2s ease-in-out',
                    borderRadius: '50%',
                    height: '100%',
                }}
            >
            </div>
            <div style={{
                justifySelf: 'center',
            }}
            >
                {this.state.status === 'ringing' && <>
                    <Button
                        variant="contained"
                        style={{
                            backgroundColor: 'green',
                            color: 'white',
                        }}
                        onClick={() => this.answer(this.state.session)}
                        startIcon={<Call />}
                    >
                Answer
                    </Button>
                    <Button
                        variant="contained"
                        style={{
                            backgroundColor: 'red',
                            color: 'white',
                        }}
                        color="secondary"
                        onClick={() => this.disconnect()}
                        startIcon={<CallEnd />}
                    >
                Reject
                    </Button>
                </>}
                {this.state.status === 'active' && <Button
                    variant="contained"
                    style={{
                        backgroundColor: 'red',
                        color: 'white',
                    }}
                    color="secondary"
                    onClick={() => this.disconnect()}
                    startIcon={<CallEnd />}
                >
                Hangup
                </Button>}
            </div>
            <div>
                <Chip label={this.state.connectionStatus} style={colors[this.state.connectionStatus]} />
                {this.state.peak}
            </div>
        </div>;
    }

    renderDialog() {
        return <Dialog
            open={this.state.rxData.dialog && this.state.status !== 'idle'}
            fullWidth
        >
            <DialogContent style={{ height: '80vh' }}>
                {this.renderContent()}
            </DialogContent>
        </Dialog>;
    }

    renderWidgetBody(props) {
        super.renderWidgetBody(props);

        const content = <>
            {!this.state.rxData.dialog && this.renderContent()}
            {this.renderDialog()}
        </>;

        return this.wrapContent(
            content,
        );
    }
}

Sip.propTypes = {
    systemConfig: PropTypes.object,
    socket: PropTypes.object,
    themeType: PropTypes.string,
    style: PropTypes.object,
    data: PropTypes.object,
};

export default withStyles(styles)(Sip);
