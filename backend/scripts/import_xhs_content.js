const DatabaseService = require('../src/services/database');
const fs = require('fs');
const path = require('path');

async function importContent(htmlPath, jsonPath) {
    try {
        const full_html = fs.readFileSync(htmlPath, 'utf8');
        const metadata = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        // Use the actual admin user ID found in the database
        const adminId = '1145c642-0fc9-4c85-8f74-c3ef6f413242';

        const contentData = {
            title: metadata.title || 'Untitled',
            full_html: full_html,
            tags: metadata.tags || [],
            description: metadata.description || '',
            content_type: 'interactive',
            language_code: metadata.language_code || 'zh-CN',
            knowledge_points: metadata.knowledge_points || [],
            metadata_json: metadata,
            tech_stack: metadata.tech_stack || ['Vue', 'Three.js', 'GSAP']
        };

        const result = await DatabaseService.createContent(contentData, adminId);
        console.log(JSON.stringify({ success: true, short_id: result.short_id, id: result.id }));
        process.exit(0);
    } catch (error) {
        console.error(JSON.stringify({ success: false, error: error.message }));
        process.exit(1);
    }
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: node import_xhs_content.js <htmlPath> <jsonPath>");
    process.exit(1);
}

importContent(args[0], args[1]);
