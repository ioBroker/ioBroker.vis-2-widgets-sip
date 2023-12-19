import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';
import {
    Button, Chip, Dialog, DialogContent, Select, MenuItem, CircularProgress, Slider,
} from '@mui/material';
import { Call, CallEnd, VolumeUp } from '@mui/icons-material';
import { WebSocketInterface, UA } from 'jssip';
import Generic from './Generic';
import SnapshotCamera from './SnapshotCamera';
import RtspCamera from './RtspCamera';
import ring from './ring.mp3';

const styles = () => ({
    content: {
        width: '100%',
        display: 'grid',
        gridTemplateRows: 'auto min-content min-content',
        height: '100%',
    },
    greenButton: {
        backgroundColor: 'green',
        color: 'white',
    },
    redButton: {
        backgroundColor: 'red',
        color: 'white',
    },
    dialog: {
        height: '80vh',
    },
    camera: {
        transition: 'background-image 0.2s ease-in-out',
        borderRadius: 16,
        height: '100%',
        overflow: 'hidden',
    },
    buttons: {
        justifySelf: 'center',
    },
    status: { display: 'flex', gap: 16, alignItems: 'center' },
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
                instance.native.cameras.forEach(iCamera => {
                    _cameras.push({
                        enabled: iCamera.enabled !== false,
                        value: `${instanceId}/${iCamera.name}`,
                        label: `cameras.${instanceId}/${iCamera.name}`,
                        subLabel: iCamera.desc ? `${iCamera.desc}/${iCamera.ip || iCamera.url || ''}` : (iCamera.ip || iCamera.url || ''),
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
        <MenuItem value="">
            {Generic.t('none')}
        </MenuItem>
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

    ringAudio = new Audio(ring);

    camera = null;

    constructor(props) {
        super(props);

        this.state.peak = 0;
        this.state.status = 'idle';
        this.state.connectionStatus = 'disconnected';
        this.state.cameraType = null;
        this.state.volume = 1;
        this.audio.volume = 1;
        this.ringAudio.loop = true;
        this.ringAudio.volume = 1;
    }

    setVolume = volume => {
        this.audio.volume = volume;
        this.setState({ volume });
    };

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
        this.ringAudio.pause();
        session.answer();
        this.setState({ status: 'active' });
        session.connection.onaddstream = e => {
            this.audio.srcObject = e.stream;
            this.audio.play();

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
        const cameraData = this.state.rxData.camera?.split('/');
        let camera = null;
        if (cameraData && cameraData.length === 2) {
            const cameraInstance = cameraData[0];
            const cameraName = cameraData[1];
            const instanceObject = await this.props.context.socket.getObject(`system.adapter.cameras.${cameraInstance}`);
            if (instanceObject && instanceObject.native && instanceObject.native.cameras) {
                camera = instanceObject.native.cameras.find(iCamera => iCamera.name === cameraName);
            }
        }
        if (camera) {
            this.setState({ cameraType: camera.type });
        } else {
            this.setState({ cameraType: null });
        }

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
            this.setState({ status: 'ringing', session: data.session });
            data.session.on('failed', () => {
                this.ringAudio.pause();
                this.setState({ peak: 0, status: 'idle' });
            });
            try {
                this.ringAudio.play();
            } catch (e) {
                console.error(e);
            }
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
        if (this.camera) {
            this.camera.onRxDataChanged();
        }
    }

    disconnect = () => {
        this.state.session.terminate();
        this.setState({ status: 'idle' });
        this.ringAudio.pause();
    };

    renderCamera() {
        if (this.state.cameraType === 'rtsp') {
            return <RtspCamera
                {...this.props}
                rxData={this.state.rxData}
                onMount={camera => this.camera = camera}
                onUnmount={() => this.camera = null}
            />;
        }
        if (this.state.cameraType === 'url') {
            return <SnapshotCamera
                {...this.props}
                rxData={this.state.rxData}
                onMount={camera => this.camera = camera}
                onUnmount={() => this.camera = null}
            />;
        }
        return undefined;
    }

    renderContent() {
        return <div
            className={this.props.classes.content}
        >
            <div
                className={this.props.classes.camera}
                style={{
                    background: this.state.peak ? `radial-gradient(rgba(0, 0, ${((this.state.peak - 20) / 20) * 255}, 0.4), rgba(0,0,0,0))` : undefined,
                }}
            >
                {(this.state.status === 'active' || this.state.status === 'ringing')
                 && this.renderCamera()}
            </div>
            <div className={this.props.classes.buttons}>
                {this.state.status === 'ringing' && <>
                    <Button
                        variant="contained"
                        className={this.props.classes.greenButton}
                        onClick={() => this.answer(this.state.session)}
                        startIcon={<Call />}
                    >
                        {Generic.t('Answer')}
                    </Button>
                    <Button
                        variant="contained"
                        className={this.props.classes.redButton}
                        color="secondary"
                        onClick={() => this.disconnect()}
                        startIcon={<CallEnd />}
                    >
                        {Generic.t('Reject')}
                    </Button>
                </>}
                {this.state.status === 'active' && <Button
                    variant="contained"
                    className={this.props.classes.redButton}
                    color="secondary"
                    onClick={() => this.disconnect()}
                    startIcon={<CallEnd />}
                >
                    {Generic.t('Hangup')}
                </Button>}
            </div>
            <div className={this.props.classes.status}>
                <Chip
                    label={Generic.t(this.state.connectionStatus)}
                    style={colors[this.state.connectionStatus]}
                />
                <Slider
                    value={this.state.volume}
                    onChange={(_, value) => this.setVolume(value)}
                    min={0}
                    max={1}
                    step={0.01}
                    valueLabelFormat={value => `${Math.round(value * 100)}%`}
                    valueLabelDisplay="auto"
                />
                <VolumeUp />
                {this.state.peak}
            </div>
        </div>;
    }

    renderDialog() {
        return <Dialog
            open={this.state.rxData.dialog && this.state.status !== 'idle'}
            fullWidth
        >
            <DialogContent className={this.props.classes.dialog}>
                {this.renderContent()}
            </DialogContent>
        </Dialog>;
    }

    renderWidgetBody(props) {
        super.renderWidgetBody(props);

        const content = <>
            {this.state.rxData.dialog ? <Chip
                label={Generic.t(this.state.connectionStatus)}
                style={colors[this.state.connectionStatus]}
            /> : this.renderContent()}
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
