import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { OpenAI } from 'openai';
import { ChatCompletion } from 'openai/resources';

let DRY_RUN = false;
let LANG_MAP: { [key: string]: string } = {};
const MAX_TOKENS = 4096;
const openai = new OpenAI({ apiKey: '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' });

async function chatGptTranslate(srcFiles: string[], language: string, targetFolder: string,
    ignorePattern: string, batchRequest: boolean): Promise<void> {
    let srcNameToText: { [key: string]: string } = {};
    let srcNameToOutputFile: { [key: string]: string } = {};

    for (const srcFile of srcFiles) {
        const targetFile = path.join(targetFolder, path.basename(srcFile));
        let srcFileName = path.basename(srcFile);
        let targetFileName = path.basename(targetFile);
        console.log(`translating[${language}] ${srcFileName} to ${targetFileName}`);

        if (srcFile.includes(ignorePattern)) {
            console.log('Ignored file, will copy');
            fs.copyFileSync(srcFile, targetFile);
            continue;
        }

        let text = fs.readFileSync(srcFile, 'utf8')
        if (!text.trim()) {
            console.log('Empty file, will copy');
            fs.copyFileSync(srcFile, targetFile);
            continue;
        } else {
            srcNameToText[srcFileName] = text;
            srcNameToOutputFile[srcFileName] = targetFile;
        }
    }

    await __chatGptTranslate(srcNameToText, srcNameToOutputFile, language, batchRequest);
}

async function __chatGptTranslate(srcNameToText: { [key: string]: string }, srcNameToOutputFile: { [key: string]: string }, targetLangLocale: string, batchRequest: boolean): Promise<void> {
    let properLanguageName = LANG_MAP[targetLangLocale] || "";
    var prompt = [
        'I want you to act as a translator for a mobile application strings',
        'Keep within length of the source text.',
        `Return only the translated text in the response, target lang/locale: ${targetLangLocale} ${properLanguageName}`,
        'Target response should be a valid JSON object in the format {fileName: content} similar to input\n\n'
    ];
    console.log(srcNameToText);
    console.log(srcNameToOutputFile);

    if (batchRequest) {
        const totalLength = Object.values(srcNameToText).reduce((a, text) => a + JSON.stringify(text).length, 0);
        if (totalLength > MAX_TOKENS) {
            throw new Error('Total characters exceed max_tokens limit.');
        }
        let jsonMap = JSON.stringify(srcNameToText);
        let content = `${prompt}${jsonMap}`;

        if (DRY_RUN) {
            console.log(content);
            return;
        }
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo', messages: [{
                role: "user",
                content: content,
            },],
            temperature: 0.5,
        });
        console.log(response);
        response.choices.forEach((choice: ChatCompletion.Choice, index: number) => {
            console.log(choice);
            console.log(index);
            let content = choice.message.content;
            if (!content) {
                console.log("content is null");
                return;
            }
            let fileNameToOutput: { [key: string]: string } = JSON.parse(content);
            for (const [fileName, output] of Object.entries(fileNameToOutput)) {
                console.log(`Writing file ${srcNameToOutputFile[fileName]}`);
                fs.writeFileSync(srcNameToOutputFile[fileName]!, output);
            }
        });
    } else {
        for (const [_, text] of Object.entries(srcNameToText)) {
            let jsonMap = JSON.stringify({ index: text });
            let content = `${prompt}${jsonMap}`;


            if (DRY_RUN) {
                console.log(content);
                return;
            }

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo', messages: [{
                    role: "user",
                    content: content,
                }]
            });
            console.log(response);
            // fs.writeFileSync(targetFiles[index], response.choices[0].message.content.trim());
        }
    }
}

(async function main() {
    const args = process.argv.slice(2);
    const dataFolder = args[0];

    if (!dataFolder) {
        console.log("could not find {dataFolder}")
        process.exit(1);
    }
    const CONFIG_FILENAME = "./config.json";

    if (!fs.existsSync(CONFIG_FILENAME)) {
        console.log("could not find config.json")
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_FILENAME, "utf-8"));
    let langList = config.langs || [];
    LANG_MAP = config.lang_map || {};
    const srcFolder = path.join(dataFolder, config.source_folder || "en-GB");

    const extensions: [string] = config.extensions || ['txt', 'md', 'json'];

    // const srcFiles = extensions.flatMap(ext => glob.sync(`${srcFolder}/*.${ext}`));
    const srcFiles = extensions.flatMap(ext => glob.sync(`${srcFolder}/**/*.${ext}`));

    DRY_RUN = config.dry_run === true;

    if (!langList.length) {
        langList = glob.sync(`${dataFolder}/*`).filter(dir => fs.lstatSync(dir).isDirectory() && dir !== srcFolder).map(dir => path.basename(dir));
        console.log(`No languages provided, derived this list: ${langList}`);
    }

    for (const language of langList) {
        if (extensions.includes('xliff')) {
            console.log("new mode");
            return;
        }
        const targetFolder = path.join(dataFolder, language);
        if (!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder);
        }
        await chatGptTranslate(srcFiles, language, targetFolder, config.ignore_pattern, config.batch_request)
    }
})();
