const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const rootDir = "d:/tecnots/workspace/capacitor projects/albiz-media/app";

function walk(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            walk(filepath, callback);
        } else if (stats.isFile() && filepath.endsWith('.tsx')) {
            callback(filepath);
        }
    }
}

function visit(node, sourceFile, filepath) {
    if (ts.isCallExpression(node)) {
        const expr = node.expression;
        let isSetState = false;
        if (ts.isIdentifier(expr) && expr.text.startsWith('set')) {
            isSetState = true;
        }

        if (isSetState) {
            // Check if it's inside useEffect, useCallback, useMemo, or an arrow function/function expression
            let current = node.parent;
            let insideSafeContext = false;
            let insideComponent = false;

            while (current) {
                if (ts.isArrowFunction(current) || ts.isFunctionExpression(current) || ts.isFunctionDeclaration(current)) {
                    // Check if it's the component itself or a hook
                    if (ts.isFunctionDeclaration(current)) {
                        const name = current.name ? current.name.text : '';
                        if (name === '' || name[0] === name[0].toUpperCase() || name.startsWith('use')) {
                            insideComponent = true;
                        }
                    } else if (ts.isVariableDeclaration(current.parent)) {
                        const name = current.parent.name.text;
                        if (name && (name[0] === name[0].toUpperCase() || name.startsWith('use'))) {
                            insideComponent = true;
                        }
                    }

                    // Are we inside a useEffect/useCallback call?
                    if (current.parent && ts.isCallExpression(current.parent)) {
                        const callName = current.parent.expression.text;
                        if (callName === 'useEffect' || callName === 'useCallback' || callName === 'useMemo' || callName === 'setTimeout' || callName === 'setInterval') {
                            insideSafeContext = true;
                            break;
                        }
                        
                        // What if it's a .then() or .catch()?
                        if (ts.isPropertyAccessExpression(current.parent.expression)) {
                            const propName = current.parent.expression.name.text;
                            if (propName === 'then' || propName === 'catch' || propName === 'finally') {
                                // We are inside a promise callback. 
                                // But is the promise inside the component body directly?
                                // If so, it's unsafe!
                                // Let's check further up!
                                let promiseParent = current.parent.parent;
                                let isPromiseSafe = false;
                                while (promiseParent) {
                                    if (ts.isArrowFunction(promiseParent) || ts.isFunctionExpression(promiseParent) || ts.isFunctionDeclaration(promiseParent)) {
                                        // Is this parent function safe?
                                        if (promiseParent.parent && ts.isCallExpression(promiseParent.parent)) {
                                            const pName = promiseParent.parent.expression.text;
                                            if (pName === 'useEffect' || pName === 'useCallback' || pName === 'useMemo') {
                                                isPromiseSafe = true;
                                                break;
                                            }
                                        }
                                        // Is this an event handler property? (e.g. onClick={...})
                                        if (promiseParent.parent && ts.isJsxExpression(promiseParent.parent)) {
                                            isPromiseSafe = true;
                                            break;
                                        }
                                    }
                                    promiseParent = promiseParent.parent;
                                }
                                if (isPromiseSafe) {
                                    insideSafeContext = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Is this an event handler property? (e.g. onClick={...})
                    if (current.parent && ts.isJsxExpression(current.parent)) {
                        insideSafeContext = true;
                        break;
                    }
                }
                current = current.parent;
            }

            if (insideComponent && !insideSafeContext) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                console.log(`${filepath}:${line + 1} - ${expr.text} called unsafely!`);
            }
        }
    }
    ts.forEachChild(node, child => visit(child, sourceFile, filepath));
}

walk(rootDir, (filepath) => {
    const src = fs.readFileSync(filepath, 'utf8');
    const sourceFile = ts.createSourceFile(filepath, src, ts.ScriptTarget.Latest, true);
    visit(sourceFile, sourceFile, filepath);
});
