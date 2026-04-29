export interface SectionController {
    getPayload(): Record<string, any>;
    captureSnapshot(): any;
    restoreSnapshot(snapshot: any): void;
}
