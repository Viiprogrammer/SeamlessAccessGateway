import fs from "fs";
import fsp from "fs/promises";

const pathSym = Symbol.for('path')

export class PersistentMap extends Map {
    constructor(iterable, path) {
        super(iterable)
        this[pathSym] = path

        let clearancesJson

        try {
            clearancesJson = JSON.parse(fs.readFileSync(path, { encoding: 'utf-8' }) || '[]')
        } catch (err) {
            clearancesJson = []
        }

        for (const [k, v] of clearancesJson) {
            super.set(k, v)
        }
    }

    set (key, value) {
        const result = super.set(key, value)
        this.syncClearances()
        return result
    }

    delete (key) {
        const result = super.delete(key)
        this.syncClearances()
        return result
    }

    async syncClearances () {
        try {
            await fsp.writeFile(
                this[pathSym],
                JSON.stringify([...super.entries()], null, 2)
            )

            console.log('Wrote Map to file')
        } catch (err) {
            console.log('Error writing Map to file', err)
        }
    }
}
