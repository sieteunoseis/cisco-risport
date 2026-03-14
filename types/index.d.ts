declare module "cisco-risport" {
  type DeviceClass =
    | "Any"
    | "Phone"
    | "Gateway"
    | "H323"
    | "Cti"
    | "VoiceMail"
    | "MediaResources"
    | "HuntList"
    | "SIPTrunk"
    | "Unknown";

  type Status =
    | "Any"
    | "Registered"
    | "UnRegistered"
    | "Rejected"
    | "PartiallyRegistered"
    | "Unknown";

  type SelectBy =
    | "Name"
    | "IPV4Address"
    | "IPV6Address"
    | "DirNumber"
    | "Description"
    | "SIPStatus";

  type Protocol = "Any" | "SCCP" | "SIP" | "Unknown";

  type DownloadStatus = "Any" | "Upgrading" | "Successful" | "Failed" | "Unknown";

  type SoapAction = "SelectCmDevice" | "SelectCmDeviceExt";

  interface CmDeviceOptions {
    action?: SoapAction;
    soapAction?: SoapAction;
    maxReturned?: number;
    maxReturnedDevices?: number;
    deviceClass?: DeviceClass;
    deviceclass?: DeviceClass;
    model?: string | number;
    status?: Status;
    node?: string;
    nodeName?: string;
    selectBy?: SelectBy;
    selectItems?: string | string[];
    selectItem?: string | string[];
    protocol?: Protocol;
    downloadStatus?: DownloadStatus;
    stateInfo?: string;
  }

  interface BatchOptions {
    chunkSize?: number;
    delayMs?: number;
    onProgress?: (batchIndex: number, totalBatches: number) => void;
  }

  interface BatchCriteria {
    maxReturned?: number;
    deviceClass?: DeviceClass;
    model?: string | number;
    status?: Status;
    node?: string;
    selectBy?: SelectBy;
    protocol?: Protocol;
    downloadStatus?: DownloadStatus;
  }

  interface CmDeviceResult {
    cookie: string;
    results: any;
    stateInfo?: string;
  }

  interface CtiDeviceResult {
    cookie: string;
    results: any;
  }

  interface ConstructorOptions {
    cookie?: string;
    [key: string]: string | undefined;
  }

  class risPortService {
    constructor(
      host: string,
      username: string,
      password: string,
      options?: ConstructorOptions,
      retry?: boolean
    );

    getCookie(): string | null;
    setCookie(cookie: string): void;

    selectCmDevice(options: CmDeviceOptions): Promise<CmDeviceResult>;
    selectCmDevice(
      soapAction: SoapAction,
      maxReturnedDevices: number,
      deviceclass: DeviceClass,
      model: string | number,
      status: Status,
      node: string,
      selectBy: SelectBy,
      selectItem: string | string[],
      protocol: Protocol,
      downloadStatus: DownloadStatus,
      stateInfo?: string
    ): Promise<CmDeviceResult>;

    selectCmDevicePaginated(options: CmDeviceOptions): Promise<CmDeviceResult>;
    selectCmDevicePaginated(
      soapAction: SoapAction,
      maxReturnedDevices: number,
      deviceclass: DeviceClass,
      model: string | number,
      status: Status,
      node: string,
      selectBy: SelectBy,
      selectItem: string | string[],
      protocol: Protocol,
      downloadStatus: DownloadStatus
    ): Promise<CmDeviceResult>;

    selectCmDeviceBatched(
      soapActionOrOpts: SoapAction | CmDeviceOptions,
      criteria: BatchCriteria,
      selectItems: string[],
      batchOptions?: BatchOptions
    ): Promise<CmDeviceResult>;

    selectCtiDevice(
      maxReturnedDevices: number,
      ctiMgrClass: string,
      status: Status,
      node: string,
      selectAppBy: string,
      appItem: string | string[],
      devName: string | string[],
      dirNumber: string | string[]
    ): Promise<CtiDeviceResult>;

    returnModels(): Record<number, string>;
    returnStatusReasons(): Record<number, string>;
  }

  export = risPortService;
}
