import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';
import {
    Button, Chip, Dialog, DialogContent, Select, MenuItem, CircularProgress,
    Slider,
} from '@mui/material';
import {
    Call, CallEnd, Mic, VolumeUp,
} from '@mui/icons-material';
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
        overflow: 'hidden',
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
    topBlock: {
        display: 'grid',
        width: '100%',
        gridTemplateColumns: 'auto min-content min-content',
        gridTemplateRows: 'auto min-content',
        overflow: 'hidden',
    },
    camera: {
        transition: 'background-image 0.2s ease-in-out',
        borderRadius: 16,
        height: '100%',
        overflow: 'hidden',
    },
    slider: {
        display: 'grid',
        gridTemplateRows: 'auto min-content',
        overflow: 'hidden',
        gap: 16,
        '& .MuiSlider-thumb': {
            display: 'none',
        },
    },
    buttons: {
        justifySelf: 'center',
        gap: 16,
        display: 'flex',
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

        this.state.outputPeak = 0;
        this.state.inputPeak = 0;
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
                            default: 'wss://sip.iobroker.net:8089/ws',
                        },
                        {
                            name: 'user',
                            label: 'user',
                            tooltip: 'user_tooltip',
                            type: 'text',
                            default: 'sip:1060@sip.iobroker.net',
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
                        {
                            name: 'invisible',
                            label: 'invisible',
                            type: 'checkbox',
                            hidden: '!data.dialog',
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
                {
                    name: 'states',
                    fields: [
                        {
                            name: 'calling-oid',
                            label: 'calling-oid-label',
                            type: 'id',
                        },
                        {
                            name: 'ringing-oid',
                            label: 'ringing-oid',
                            type: 'id',
                        },
                        {
                            name: 'connected-oid',
                            label: 'connected-oid',
                            type: 'id',
                        },
                        {
                            name: 'calling-number-oid',
                            label: 'calling-number-oid',
                            type: 'id',
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
        this.setValue('calling', true);
        this.setValue('ringing', false);
        session.connection.onaddstream = async e => {
            this.audio.srcObject = e.stream;
            this.audio.play();

            const outputAudioContext = new AudioContext();
            const output = outputAudioContext.createMediaStreamSource(e.stream);
            const outputAnalyser = outputAudioContext.createAnalyser();
            output.connect(outputAnalyser);
            outputAnalyser.connect(outputAudioContext.destination);
            outputAnalyser.fftSize = 64;
            const outputFrequencyData = new Uint8Array(outputAnalyser.frequencyBinCount);
            outputAnalyser.getByteFrequencyData(outputFrequencyData);

            const inputAudioContext = new AudioContext();
            const input = inputAudioContext.createMediaStreamSource(await navigator.mediaDevices.getUserMedia({ audio: true, video: false }));
            const inputAnalyser = inputAudioContext.createAnalyser();
            input.connect(inputAnalyser);
            // inputAnalyser.connect(inputAudioContext.destination);
            inputAnalyser.fftSize = 64;
            const inputFrequencyData = new Uint8Array(inputAnalyser.frequencyBinCount);
            inputAnalyser.getByteFrequencyData(inputFrequencyData);

            const update = () => {
                outputAnalyser.getByteFrequencyData(outputFrequencyData);
                inputAnalyser.getByteFrequencyData(inputFrequencyData);
                const outputPeakFrequency = outputFrequencyData.reduce((a, b) => a + b, 0) / outputFrequencyData.length;
                const inputPeakFrequency = inputFrequencyData.reduce((a, b) => a + b, 0) / inputFrequencyData.length;
                this.setState({ outputPeak: outputPeakFrequency, inputPeak: inputPeakFrequency });
            };

            const interval = setInterval(update, 100);
            session.on('ended', () => {
                clearInterval(interval);
                this.setState({ outputPeak: 0, inputPeak: 0, status: 'idle' });
                this.setValue('calling', false);
                this.setValue('ringing', false);
                this.setValue('calling-number', '');
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
            this.setValue('calling', false);
            this.setValue('ringing', false);
            this.setValue('connected', false);
            this.setValue('calling-number', '');
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
            this.setValue('ringing', true);
            this.setValue('calling-number', data.request.from.uri.user);
            data.session.on('failed', () => {
                this.ringAudio.pause();
                this.setState({ outputPeak: 0, inputPeak: 0, status: 'idle' });
                this.setValue('calling', false);
                this.setValue('ringing', false);
                this.setValue('calling-number', '');
            });
            try {
                this.ringAudio.play();
            } catch (e) {
                console.error(e);
            }
        });

        this.sipUA.on('connecting', () => {
            this.setState({ connectionStatus: 'connecting' });
            this.setValue('connected', false);
        });
        this.sipUA.on('connected', () => {
            this.setState({ connectionStatus: 'connected' });
            this.setValue('connected', true);
        });
        this.sipUA.on('disconnected', () => {
            this.setState({ connectionStatus: 'disconnected' });
            this.setValue('connected', false);
        });

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

    setValue(name, value) {
        if (this.state.rxData[`${name}-oid`]) {
            this.props.context.socket.setState(this.state.rxData[`${name}-oid`], value);
        }
    }

    disconnect = () => {
        this.state.session.terminate();
        this.setState({ status: 'idle' });
        this.setValue('calling', false);
        this.setValue('ringing', false);
        this.setValue('calling-number', '');
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

    // eslint-disable-next-line class-methods-use-this
    renderSlider(value, icon) {
        return <div className={this.props.classes.slider}>
            <Slider
                orientation="vertical"
                value={value}
                disabled
                min={20}
                max={80}
            />
            {icon}
        </div>;
    }

    renderContent() {
        return <div
            className={this.props.classes.content}
        >
            <div
                className={this.props.classes.topBlock}
            >
                {this.state.status === 'active' || this.state.status === 'ringing' ?
                    <div className={this.props.classes.camera}>
                        {this.renderCamera()}
                    </div> : null}
                {this.state.status === 'active' && <>
                    {this.renderSlider(this.state.inputPeak, <Mic />)}
                    {this.renderSlider(this.state.outputPeak, <VolumeUp />)}
                </>}
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
            </div>
            <div className={this.props.classes.status}>
                <Chip
                    label={Generic.t(this.state.connectionStatus)}
                    style={colors[this.state.connectionStatus]}
                />
                {/* <Slider
                    value={this.state.volume}
                    onChange={(_, value) => this.setVolume(value)}
                    min={0}
                    max={1}
                    step={0.01}
                    valueLabelFormat={value => `${Math.round(value * 100)}%`}
                    valueLabelDisplay="auto"
                />
                <VolumeUp /> */}
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

        if (this.state.rxData.invisible) {
            return undefined;
        }

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
