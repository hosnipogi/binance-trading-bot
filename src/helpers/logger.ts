class Logger {
    public info(message: any) {
        const msg = {
            time: new Date().toUTCString(),
            message,
        };
        console.info(msg);
    }

    public error(message: any) {
        const msg = {
            time: new Date().toUTCString(),
            ...message,
        };
        console.error(msg);
    }
}

const logger = new Logger();
export default logger;
