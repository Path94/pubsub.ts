import * as common from "common";
import * as entry from "entry";

// New returns a new instance of PubSub
export function New<T>(): PubSub<T> {
	return new PubSub<T>();
}

// PubSub is a pubsub data store
export class PubSub<T> {
	// Entry map
	private m: entryMap<T>;
	// Global-level subscribers
	private s: common.Subber<T>;

	constructor() {
		// Create a fresh entry map
		this.m = newEntryMap();
		// Set internal subber with a prefix of "global"
		this.s = new common.Subber<T>("global");
	}

	private createEntry(key: string): entry.Entry<T> {
		let e = this.m[key];
		if (!!e) {
			// Entry exists - no need to create, return early
			return e;
		}

		// Create a new entry and set it within the map AND as our local e variable
		e = this.m[key] = new entry.Entry(key);
		this.s.ForEach((sKey: string, fn: common.SubFn<T>) => e.Sub(fn, sKey));
		// Return reference to entry
		return e;
	}

	private forEach(fn: (key: string, e: entry.Entry<T>) => void) {
		Object.keys(this.m).forEach((key: string) => {
			const e = this.m[key];
			fn(key, e);
		});
	}

	private sub(fn: common.SubFn<T>) {
		const sk = this.s.Sub(fn);
		this.forEach((key: string, e: entry.Entry<T>) => e.Sub(fn, sk));
		return sk;
	}

	private unsub(key: string): boolean {
		if (!this.s.Unsub(key)) {
			console.error("Could not unsub key!", key);
			// Key doesn't exist within global sub list. Because there is no need
			// to attempt to unsub at the Entry level, we can return early.
			return false;
		}

		// Unsub from each entry
		this.forEach((_: string, e: entry.Entry<T>) => e.Unsub(key));
		return true;
	}

	// Get will get a value for a provided key
	// Note: Will return null if key match is not found
	Get(key: string): T | null {
		const entry = this.m[key];
		if (!entry) {
			return null;
		}

		return entry.Get();
	}

	// Put will set a key/val pair and notify all related subscribers
	Put(key: string, val: T) {
		if (key === "*") {
			console.error("invalid key", key);
			return;
		}

		const entry = this.createEntry(key);
		// Put value for entry
		entry.Put(val);
	}

	// Delete will remove an entry for a provided key
	// Note: All subscribers will be called with a null value to indicate 
	// closing of the entry.
	Delete(key: string): boolean {
		const entry = this.m[key];
		if (!entry) {
			// Entry does not exist, return early
			return false;
		}
		// Close entry
		entry.Close();
		// Return the delete state of removing the provided key from the entries map
		return delete this.m[key];
	}

	// Sub will subscribe a listener for a provided key
	Sub(key: string, fn: common.SubFn<T>): string {
		if (key === "*") {
			// Run global sub and return
			return this.sub(fn);
		}

		const entry = this.createEntry(key);
		// Subscribe provided function to entry
		return entry.Sub(fn);
	}

	// Unsub will unsubscribe a listener for a provided key
	Unsub(key: string): boolean {
		// Entry key is the prefix of the key indicating which entry is belongs to.
		const entryKey = key.split("_")[0];
		// Wildcard ("*") values are given the prefix "global".
		if (entryKey === "global") {
			// Run global unsub and return
			return this.unsub(key);
		}

		const entry = this.m[entryKey];
		if (!entry) {
			// Entry doesn't exist, return early
			return false;
		}

		// Unsubscribe provided key from entry
		return entry.Unsub(key)
	}

	Close() {
		for (var k in this.m) {
			this.m[k].Close();
			delete this.m[k];
		}
	}
}

export type SubFn<T> = common.SubFn<T>;

// newEntryMap returns a new entry map
function newEntryMap<T>(): entryMap<T> {
	const m = <entryMap<T>>{};
	return m;
}

// entryMap is a QoL type to cleanup references to maps containing only entries
type entryMap<T> = { [key: string]: entry.Entry<T> };
