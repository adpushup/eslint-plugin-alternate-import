ESLint-Plugin-Alternate-Import
===============================

# Installation

Install [ESLint](https://www.github.com/eslint/eslint) either locally or globally. (Note that locally, per project, is strongly preferred)

```sh
$ npm install eslint --save-dev
```

Install Plugin

```sh
$ npm install eslint-plugin-alternate-import --save-dev
```

# Configuration

Following is a sample configuration for how to restrict a package and suggest alternatives. It support both ES6 `import` and ES5 `require()` syntax.


```json5
{
  "settings": {
    "alternate-import": {
        "alternatePackagesMap": [
            {
                "original": "restricted-package-name", // use alternate instead of original
                "alternate": "alternate-package-name"
            },
            {
                "original": "react-bootstrap", // import from file instead of original package
                "alternate": "/react-bootstrap-imports.js"
            },
            {
                "original": "restricted-package-name" // Restric package but do not suggest any alternative
            }
        ],
        "customFileImportRootPrefix": "@" // Prepend static path to alternate custom file(s) 
    },
  }
}
```


## Why this plugin?

As an owner of the project, you need to be sure that your project does not include any of the known possible bad or unnecessary npm package(s). With this, you can restrict the use of those kinds of npm packages in your project and can suggest a better alternative.

Eg: Instead of using moment.js for some basic time manipulation you can use some lightweight date library or you can use your custom utility. But, now you also want to restrict everyone contributing to your project to follow this particular rule. Here you can use this plugin and it will help you in the following cases:

1. Restrict use of Deprecated package(s).
2. Restrict the use of package(s) with known Security Vulnerabilities.
3. Restrict the use of package(s) for which we know some better alternatives.
4. Restrict use of package(s) which may have compatibility issues with current dependencies and environment.

```json5
{
  "settings": {
    "alternate-import": {
        "alternatePackagesMap": [
            {
                "original": "package-which-is-deprecated-and-not-secure-and-compatible", //restrict
                "alternate": "much-better-package" // better suggestion
            },
            {
                "original": "package-with-es5-require", // automatic support for both ES6 Import and ES5 require() syntax
                "alternate": "much-better-package" // better suggestion
            },
            {
                "original": "package-with-lots-of-unwanted-code",
                "alternate": "/react-bootstrap-imports.js" // use import from file instead of original package - less code
            }

        ]
    },
  }
}
```


# Treeshaking (Our Use Case)

Consider a case where you use 
```js
   import { Row, Col, Panel } from 'bootstrap'
```

During build you will find that it includes complete code of 'bootstrap' package.

To get the benefit of tree-shaking you need to change you code to

```js
   import Row from 'bootstrap/lib/Row'
   import Col from 'bootstrap/lib/Col'
   import Panel from 'bootstrap/lib/Panel'
```
which is not actually a good thing to update all the imports in each and every file of the project.

A better way to do this(in our opinion) would be to create a common utility type file and import individual items and export individually from that new file like

`bootstrap-helper-import.js`

```js
   import Row from 'bootstrap/lib/Row'
   import Col from 'bootstrap/lib/Col'
   import Panel from 'bootstrap/lib/Panel'

    export {
        Row,
        Col,
        Panel
    }
```
and use it as

```js
   import { Row, Col, Panel } from './util/bootstrap-helper-import' //This will tree-shake
```
instead of

```js
   import { Row, Col, Panel } from 'bootstrap'
```

Just do `find and replace all` to replace `from 'bootstrap'` to `from './util/bootstrap-helper-import'` and use this plugin to create rule that support suggesting `custom file` instead of a `npm package`


## License
