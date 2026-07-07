export namespace main {
	
	export class widgetPositionAssignment {
	    widget: string;
	    corner: string;
	
	    static createFrom(source: any = {}) {
	        return new widgetPositionAssignment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.widget = source["widget"];
	        this.corner = source["corner"];
	    }
	}
	export class monitorProviderAssignment {
	    monitorIndex: number;
	    provider: string;
	    widgets: string[];
	    widgetPositions?: widgetPositionAssignment[];
	    stackWidgets: boolean;
	
	    static createFrom(source: any = {}) {
	        return new monitorProviderAssignment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.monitorIndex = source["monitorIndex"];
	        this.provider = source["provider"];
	        this.widgets = source["widgets"];
	        this.widgetPositions = this.convertValues(source["widgetPositions"], widgetPositionAssignment);
	        this.stackWidgets = source["stackWidgets"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class providerCurrencyConfig {
	    baseCurrency: string;
	    targets: string[];
	
	    static createFrom(source: any = {}) {
	        return new providerCurrencyConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseCurrency = source["baseCurrency"];
	        this.targets = source["targets"];
	    }
	}
	export class providerWeatherConfig {
	    apiKey: string;
	    city: string;
	    corner: string;
	    backgroundImagePath: string;
	    enableMetar: boolean;
	    enableTaf: boolean;
	    airports: string;
	
	    static createFrom(source: any = {}) {
	        return new providerWeatherConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKey = source["apiKey"];
	        this.city = source["city"];
	        this.corner = source["corner"];
	        this.backgroundImagePath = source["backgroundImagePath"];
	        this.enableMetar = source["enableMetar"];
	        this.enableTaf = source["enableTaf"];
	        this.airports = source["airports"];
	    }
	}
	export class providerPlaneConfig {
	    apiKey: string;
	    workspaceSlug: string;
	    projectId: string;
	
	    static createFrom(source: any = {}) {
	        return new providerPlaneConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKey = source["apiKey"];
	        this.workspaceSlug = source["workspaceSlug"];
	        this.projectId = source["projectId"];
	    }
	}
	export class appConfig {
	    configVersion: number;
	    lastUpdatedAtUnix?: number;
	    runOnStartup?: boolean;
	    planeUpdateIntervalMinutes: number;
	    weatherUpdateIntervalMinutes: number;
	    plane: providerPlaneConfig;
	    weather: providerWeatherConfig;
	    currency: providerCurrencyConfig;
	    monitorAssignments: monitorProviderAssignment[];
	    kanbanTheme: string;
	    planeApiKey?: string;
	    workspaceSlug?: string;
	    projectId?: string;
	    monitorAll?: boolean;
	    monitorIndexes?: number[];
	    updateIntervalMinutes?: number;
	
	    static createFrom(source: any = {}) {
	        return new appConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.configVersion = source["configVersion"];
	        this.lastUpdatedAtUnix = source["lastUpdatedAtUnix"];
	        this.runOnStartup = source["runOnStartup"];
	        this.planeUpdateIntervalMinutes = source["planeUpdateIntervalMinutes"];
	        this.weatherUpdateIntervalMinutes = source["weatherUpdateIntervalMinutes"];
	        this.plane = this.convertValues(source["plane"], providerPlaneConfig);
	        this.weather = this.convertValues(source["weather"], providerWeatherConfig);
	        this.currency = this.convertValues(source["currency"], providerCurrencyConfig);
	        this.monitorAssignments = this.convertValues(source["monitorAssignments"], monitorProviderAssignment);
	        this.kanbanTheme = source["kanbanTheme"];
	        this.planeApiKey = source["planeApiKey"];
	        this.workspaceSlug = source["workspaceSlug"];
	        this.projectId = source["projectId"];
	        this.monitorAll = source["monitorAll"];
	        this.monitorIndexes = source["monitorIndexes"];
	        this.updateIntervalMinutes = source["updateIntervalMinutes"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	

}

