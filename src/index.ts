#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import {Readable} from 'node:stream'
import {finished} from 'node:stream/promises'

import sharp from 'sharp'
import {setWallpaper} from 'wallpaper'

import {HEIGHT, LOCAL_PANEL_DIR, PADDING, URL_BASE, WIDTH} from './const.js'

fs.mkdirSync(LOCAL_PANEL_DIR, {recursive: true})

function dateToParts(date: Date, separator: '/' | '-'): string {
    return [
        date.getFullYear(),
        (date.getMonth() + 1).toString().padStart(2, '0'),
        date.getDate().toString().padStart(2, '0'),
    ].join(separator)
}

function getLocalName(date: Date) {
    return dateToParts(date, '-')
}

async function downloadImage(url: string, target: string): Promise<void> {
    if (fs.existsSync(target)) {
        return
    }
    try {
        const response = await fetch(url)
        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`, url)
            return
        }
        if (!response.body) {
            console.error('Response body is null')
            return
        }
        const stream = fs.createWriteStream(target)
        await finished(Readable.fromWeb(response.body).pipe(stream))
    }
    catch (error) {
        console.error('Error while downloading panel:', error)
    }
}

// keep for later, if we need to get the color of the border
type Color = Record<'r' | 'g' | 'b', number>
// async function getBorderColor({data}: {data: Buffer}): Promise<Color> {
async function getBorderColor(input: string): Promise<Color> {
    const image = sharp(input).blur(5)
    return (await image.stats()).dominant
    // const {width, height} = info
    // const heightSides = height - (2 * BLEND_SIZE)
    // const stats = await Promise.all([
    //     image.extract({left: 0, top: 0, width, height: BLEND_SIZE}).stats(),
    //     image.extract({left: 0, top: height - BLEND_SIZE - 1, width, height: BLEND_SIZE}).stats(),
    //     image.extract({left: 0, top: BLEND_SIZE, width: BLEND_SIZE, height: heightSides}).stats(),
    //     image.extract({left: width - BLEND_SIZE - 1, top: BLEND_SIZE, width: BLEND_SIZE, height: heightSides}).stats(),
    // ])
    // return stats.reduce<Color>((acc, {dominant}) => {
    //     console.log(dominant)
    //     acc.r += dominant.r / 4
    //     acc.g += dominant.g / 4
    //     acc.b += dominant.b / 4
    //     return acc
    // }, {r: 0, g: 0, b: 0})
    // const [r, g, b] = (await image.stats()).channels.map((c) => c.mean)
    // return {r: r || 0, g: g || 0, b: b || 0}
}

async function scaleImage(input: string, output: string): Promise<void> {
    if (fs.existsSync(output)) {
        return
    }
    const scaled = sharp(input).resize({
        width: WIDTH - PADDING * 2,
        height: HEIGHT - PADDING * 2,
        fit: sharp.fit.inside,
        kernel: sharp.kernel.cubic,
    })
    const scaledBuffer = await scaled.toBuffer({resolveWithObject: true})
    const color = await getBorderColor(input)
    const background = sharp({create: {width: WIDTH, height: HEIGHT, channels: 3, background: color}})
    await background.composite([
        {input: scaledBuffer.data},
    ]).toFile(output)
}

async function updatePanel(): Promise<void> {
    const today = new Date()
    const localScaledFile = path.resolve(LOCAL_PANEL_DIR, `${getLocalName(today)}_scaled.webp`)
    if (fs.existsSync(localScaledFile)) {
        // do nothing if today's panel is already downloaded
        return
    }
    const url = `${URL_BASE}/${dateToParts(today, '/')}.webp`
    const localRawFile = path.resolve(LOCAL_PANEL_DIR, `${getLocalName(today)}_raw.webp`)
    await downloadImage(url, localRawFile)
    await scaleImage(localRawFile, localScaledFile)
    await setWallpaper(localScaledFile, {screen: 'all'})
}

updatePanel()
