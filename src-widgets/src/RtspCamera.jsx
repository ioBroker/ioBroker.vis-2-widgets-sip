import React from 'react';
import { CircularProgress } from '@mui/material';

import Generic from './Generic';

const styles = {
    camera: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        cursor: 'pointer',
    },
    imageContainer: {
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        height: '100%',
    },
};

class RtspCamera extends React.Component {
    constructor(props) {
        super(props);
        this.videoInterval = null;
        this.videoRef = React.createRef();
        this.currentCam = null;
        this.state = {};
        this.state.alive = false;
    }

    static drawCamera(ref, data) {
        const canvas = ref.current;
        if (!canvas) {
            return;
        }
        const context = canvas.getContext('2d');
        try {
            const imageObj = new Image();
            imageObj.src = `data:image/jpeg;base64,${data}`;
            imageObj.onload = () => {
                canvas.width = imageObj.width;
                canvas.height = imageObj.height;
                // const hRatio = canvas.width  / imageObj.width;
                // const vRatio = canvas.height / imageObj.height;
                // const ratio  = Math.min(hRatio, vRatio);
                // const centerShiftX = (canvas.width - imageObj.width * ratio) / 2;
                // const centerShiftY = (canvas.height - imageObj.height * ratio) / 2;
                // context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(
                    imageObj,
                    0,
                    0,
                    imageObj.width,
                    imageObj.height,
                    // centerShiftX,
                    // centerShiftY,
                    // imageObj.width * ratio,
                    // imageObj.height * ratio,
                );
            };
            imageObj.onerror = e => {
                console.error(e);
            };
        } catch (e) {
            console.error(e);
        }
    }

    updateStream = (id, state) => {
        if (state?.val) {
            if (this.state.loading) {
                this.setState({ loading: false });
            }

            RtspCamera.drawCamera(this.videoRef, state.val);
        }
    };

    static getNameAndInstance(value) {
        if (!value) {
            return null;
        }
        const pos = value.indexOf('/');
        if (pos === -1) {
            return null;
        }
        return {
            instanceId: value.substring(0, pos),
            name: value.substring(pos + 1),
        };
    }

    onCameras = data => {
        if (data) {
            // if it is success or error object
            if (typeof data === 'object' && (data.accepted || data.error)) {
                if (data.error) {
                    console.error(data.error);
                }
                return;
            }

            if (this.state.loading) {
                this.setState({ loading: false });
            }
            RtspCamera.drawCamera(this.videoRef, data);
        }
    };

    async propertiesUpdate() {
        if (this.useMessages === undefined) {
            this.useMessages = await this.props.context.socket.checkFeatureSupported('INSTANCE_MESSAGES');
        }
        if (this.props.rxData.camera !== this.currentCam) {
            // check if camera instance is alive
            if (this.state.alive) {
                // this.width = this.getImageWidth();
                // if we were subscribed, unsubscribe
                if (this.currentCam) {
                    const { instanceId, name } = RtspCamera.getNameAndInstance(this.currentCam);
                    if (this.useMessages) {
                        await this.props.context.socket.unsubscribeFromInstance(
                            `cameras.${instanceId}`,
                            `startCamera/${name}`,
                            this.onCameras,
                        );
                    } else {
                        // Bluefox 2023.09.28: delete this branch after js-controller 5.0.13 will be mainstream
                        await this.props.context.socket.setState(`cameras.${instanceId}.${name}.running`, {
                            val: false,
                        });
                        await this.props.context.socket.unsubscribeState(
                            `cameras.${instanceId}.${name}.stream`,
                            this.updateStream,
                        );
                    }
                }

                // subscribe on new camera
                if (this.props.rxData.camera) {
                    this.setState({ loading: true });
                    const { instanceId, name } = RtspCamera.getNameAndInstance(this.props.rxData.camera);
                    if (this.useMessages) {
                        await this.props.context.socket.subscribeOnInstance(
                            `cameras.${instanceId}`,
                            `startCamera/${name}`,
                            { width: this.getImageWidth() },
                            this.onCameras,
                        );
                    } else {
                        await this.props.context.socket.subscribeState(
                            `cameras.${instanceId}.${name}.stream`,
                            this.updateStream,
                        );
                    }
                } else {
                    const canvas = this.videoRef.current;
                    if (canvas) {
                        const context = canvas.getContext('2d');
                        context.clearRect(0, 0, canvas.width, canvas.height);
                    }
                }
                this.currentCam = this.props.rxData.camera;
            } else if (this.currentCam) {
                // not alive
                const { instanceId, name } = RtspCamera.getNameAndInstance(this.currentCam);
                if (!this.useMessages) {
                    await this.props.context.socket.setState(`cameras.${instanceId}.${name}.running`, { val: false });
                    await this.props.context.socket.unsubscribeState(
                        `cameras.${instanceId}.${name}.stream`,
                        this.updateStream,
                    );
                }
                this.currentCam = null;
            }
        } else if (this.currentCam && this.state.alive) {
            // refresh stream
            const { instanceId, name } = RtspCamera.getNameAndInstance(this.currentCam);
            if (this.useMessages) {
                await this.props.context.socket.subscribeOnInstance(
                    `cameras.${instanceId}`,
                    `startCamera/${name}`,
                    { width: this.getImageWidth() },
                    this.onCameras,
                );
            } else {
                await this.props.context.socket.setState(`cameras.${instanceId}.${name}.running`, {
                    val: true,
                    expire: 30, // expire in 30 seconds
                });
            }
        } else if (this.currentCam && !this.state.alive) {
            // not alive
            const { instanceId, name } = RtspCamera.getNameAndInstance(this.currentCam);
            if (!this.useMessages) {
                await this.props.context.socket.setState(`cameras.${instanceId}.${name}.running`, { val: false });
                await this.props.context.socket.unsubscribeState(
                    `cameras.${instanceId}.${name}.stream`,
                    this.updateStream,
                );
            }
            this.currentCam = null;
        }
    }

    getImageWidth() {
        return this.videoRef.current?.parentElement.clientWidth || 0;
    }

    async subscribeOnAlive() {
        const data = RtspCamera.getNameAndInstance(this.props.rxData.camera);

        if (this.subsribedOnAlive !== (data ? data.instanceId : null)) {
            if (this.subsribedOnAlive) {
                this.props.context.socket.unsubscribeState(
                    `system.adapter.cameras.${this.subsribedOnAlive}.alive`,
                    this.onAliveChanged,
                );
                this.subsribedOnAlive = '';
            }
            if (data) {
                this.props.context.socket.subscribeState(
                    `system.adapter.cameras.${data.instanceId}.alive`,
                    this.onAliveChanged,
                );
                this.subsribedOnAlive = data.instanceId;
            }
        }
    }

    onAliveChanged = (id, state) => {
        const data = RtspCamera.getNameAndInstance(this.props.rxData.camera);
        if (data && id === `system.adapter.cameras.${data.instanceId}.alive`) {
            const alive = !!state?.val;
            if (alive !== this.state.alive) {
                this.setState({ alive }, () => this.propertiesUpdate());
            }
        }
    };

    componentDidMount() {
        this.props.onMount(this);
        setTimeout(() => this.propertiesUpdate(), 100);

        this.subscribeOnAlive();

        this.videoInterval = setInterval(() => this.propertiesUpdate(), 14000);
    }

    // eslint-disable-next-line react/no-unused-class-component-methods
    onRxDataChanged = async (/* prevRxData */) => {
        await this.subscribeOnAlive();
        await this.propertiesUpdate();
    };

    componentWillUnmount() {
        this.props.onUnmount();
        this.videoInterval && clearInterval(this.videoInterval);
        this.videoInterval = null;

        if (this.subsribedOnAlive) {
            this.props.context.socket.unsubscribeState(
                `system.adapter.cameras.${this.subsribedOnAlive}.alive`,
                this.onAliveChanged,
            );
            this.subsribedOnAlive = null;
        }

        if (this.currentCam) {
            const { instanceId, name } = RtspCamera.getNameAndInstance(this.currentCam);
            if (this.useMessages) {
                this.props.context.socket
                    .unsubscribeFromInstance(`cameras.${instanceId}`, `startCamera/${name}`, this.onCameras)
                    .catch(e => console.error(e));
            }
        }
    }

    render() {
        const content = (
            <div style={styles.imageContainer}>
                {this.state.loading && this.state.alive && <CircularProgress style={styles.progress} />}
                {!this.state.alive ? (
                    <div style={{ position: 'absolute', top: 0, left: 0 }}>
                        {Generic.t('Camera instance %s inactive', (this.props.rxData.camera || '').split('/')[0])}
                    </div>
                ) : null}
                <canvas
                    ref={this.videoRef}
                    style={styles.camera}
                ></canvas>
            </div>
        );

        return content;
    }
}

export default RtspCamera;
