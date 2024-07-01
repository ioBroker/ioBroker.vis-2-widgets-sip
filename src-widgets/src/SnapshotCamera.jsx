import React, { Component } from 'react';
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

class SnapshotCamera extends Component {
    constructor(props) {
        super(props);
        this.videoRef = React.createRef();
        this.state = {};
        this.state.alive = false;
        this.state.error = false;
    }

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

    getImageWidth() {
        return this.videoRef.current?.parentElement.clientWidth || 0;
    }

    async subscribeOnAlive() {
        const data = SnapshotCamera.getNameAndInstance(this.props.rxData.camera);

        if (this.subsribedOnAlive !== (data ? data.instanceId : null)) {
            if (this.subsribedOnAlive) {
                this.props.context.socket.unsubscribeState(`system.adapter.cameras.${this.subsribedOnAlive}.alive`, this.onAliveChanged);
                this.subsribedOnAlive = '';
            }
            if (data) {
                this.props.context.socket.subscribeState(`system.adapter.cameras.${data.instanceId}.alive`, this.onAliveChanged);
                this.subsribedOnAlive = data.instanceId;
            }
        }
    }

    updateImage = () => {
        if (!this.loading) {
            this.loading = true;
            if (this.videoRef.current) {
                this.videoRef.current.src = this.getUrl();
                this.videoRef.current.onload = e => {
                    if (e.target && !e.target.style.opacity !== '1') {
                        e.target.style.opacity = '1';
                    }
                    this.state.error && this.setState({ error: false });
                    this.loading = false;
                };
                this.videoRef.current.onerror = e => {
                    if (e.target && e.target.style.opacity !== '0') {
                        e.target.style.opacity = '0';
                    }
                    !this.state.error && this.setState({ error: true });

                    this.loading = false;
                };
            }
        }
    };

    restartPollingInterval() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this.state.alive) {
            this.pollingInterval = setInterval(this.updateImage, parseInt(this.props.rxData.pollingInterval, 10) || 500);
        }
    }

    onAliveChanged = (id, state) => {
        const data = SnapshotCamera.getNameAndInstance(this.props.rxData.camera);
        if (data && id === `system.adapter.cameras.${data.instanceId}.alive`) {
            const alive = !!(state?.val);
            if (alive !== this.state.alive) {
                this.setState({ alive }, () => this.restartPollingInterval());
            }
        }
    };

    componentDidMount() {
        this.props.onMount(this);
        this.subscribeOnAlive();
    }

    // eslint-disable-next-line react/no-unused-class-component-methods
    onRxDataChanged = async (/* prevRxData */) => {
        await this.subscribeOnAlive();
    };

    componentWillUnmount() {
        this.props.onUnmount();
        this.pollingInterval && clearInterval(this.pollingInterval);
        this.pollingInterval = null;

        if (this.subsribedOnAlive) {
            this.props.context.socket.unsubscribeState(`system.adapter.cameras.${this.subsribedOnAlive}.alive`, this.onAliveChanged);
            this.subsribedOnAlive = null;
        }
    }

    getUrl() {
        if (this.props.rxData.camera) {
            const url = `../cameras.${this.props.rxData.camera}?`;
            const params = [
                `ts=${Date.now()}`,
                `w=${this.getImageWidth()}`,
                `noCache=${false}`,
                this.props.rxData.rotate ? `angle=${this.props.rxData.rotate}` : '',
            ];
            return url + params.filter(p => p).join('&');
        }

        return '';
    }

    render() {
        const url = this.getUrl();

        const content = <div
            style={styles.imageContainer}
        >
            {!this.state.alive ? <div
                style={{ position: 'absolute', top: 20, left: 0 }}
            >
                {Generic.t('Camera instance %s inactive', (this.props.rxData.camera || '').split('/')[0])}
            </div> : null}
            {url ? <img
                src={url}
                ref={this.videoRef}
                style={styles.camera}
                alt={this.props.rxData.camera}
            /> : Generic.t('No camera selected')}
            {this.state.alive && this.state.error ? <div
                style={{
                    position: 'absolute',
                    top: 20,
                    left: 0,
                }}
            >
                <div style={{ color: 'red' }}>
                    {Generic.t('Cannot load URL')}
                    :
                </div>
                <div>{this.getUrl(true)}</div>
            </div> : null}
        </div>;

        return content;
    }
}

export default SnapshotCamera;
