import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';
import { Button, Dialog, DialogContent } from '@mui/material';
import { WebSocketInterface, UA } from 'jssip';
import { useVisualizer, models } from 'react-audio-viz';
import Generic from './Generic';

const styles = () => ({
    content: {
        width: '100%',
        display: 'grid',
        gridTemplateRows: 'auto min-content min-content',
        height: '100%',
    },
});

const AudioViz = props => {
    const [ReactAudioViz, initializeVisualizer] = useVisualizer({ current:props.audio });
    props.audio.onplay = () => {
        initializeVisualizer();
    };

    return (
        <div>
            <div style={{ width: '400', height: '400' }}>
                {ReactAudioViz && <ReactAudioViz model={models.polar()} />}
            </div>
        </div>
    );
};

class Sip extends Generic {
    divRef = React.createRef();

    sipSocket = null;

    sipUA = null;

    audio = document.createElement('audio');

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

    async propertiesUpdate() {
        if (this.sipSocket) {
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
            data.session.answer();
            window.data = data;
            console.log(data.session.connection);
            data.session.connection.onaddstream = e => {
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

                function update() {
                    analyser.getByteFrequencyData(frequencyData);
                    const peak_frequency = frequencyData.reduce((a, b) => a + b, 0) / frequencyData.length;
                    console.log(peak_frequency);
                }
                
                setInterval(update, 1000);
            };
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
    }

    componentDidUpdate() {

    }

    renderWidgetBody(props) {
        super.renderWidgetBody(props);

        const content = <div
            className={this.props.classes.content}
        >
            <AudioViz audio={this.audio} />
        </div>;

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
