const fs = require('fs');
const content = fs.readFileSync('src/features/app-shell/ui/components/MainSurface.tsx', 'utf8');

if (content.includes('loadMore')) {
    console.log("Load more is there");
} else {
    console.log("Missing");
}
