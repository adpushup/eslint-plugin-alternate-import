const path = require('path');
const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

function reportErrorAndFix(
	context,
	node,
	matchedRestrictedPackage,
	importedVariableNames,
	isAlternateCustomPackage,
	missingExportInAlternatePackage,
	customFileImportRootPrefix
) {
	return context.report({
		node,
		message: `Direct import restricted for "${node.source.value}" package, Please import from "${
			matchedRestrictedPackage.alternate
		}" instead${
			isAlternateCustomPackage && missingExportInAlternatePackage.length
				? ` and export "${missingExportInAlternatePackage.join(', ')}" variables from it`
				: ''
		}.`,
		fix: function(fixer) {
			return fixer.replaceText(
				node,
				`import ${importedVariableNames} from '${
					!isAlternateCustomPackage
						? `${matchedRestrictedPackage.alternate}`
						: `${customFileImportRootPrefix}${matchedRestrictedPackage.alternate.replace(
								/.js$/,
								''
						  )}`
				}';`
			);
		}
	});
}

function checkCustomFileImport(
	matchedRestrictedPackage,
	context,
	node,
	importedVariableNames,
	isAlternateCustomPackage,
	customFileImportRootPrefix
) {
	let alternatePackageCode;
	try {
		alternatePackageCode = fs
			.readFileSync(path.join(process.cwd(), matchedRestrictedPackage.alternate))
			.toString();
	} catch (err) {
		return context.report({
			node,
			message: `Direct import restricted for "${
				node.source.value
			}" package, Unable to find alternative import path "${matchedRestrictedPackage.alternate}".`
		});
	}

	// If custom import file is empty
	if (!alternatePackageCode) {
		const missingExportInAlternatePackage = importedVariableNames;
		return reportErrorAndFix(
			context,
			node,
			matchedRestrictedPackage,
			importedVariableNames,
			isAlternateCustomPackage,
			missingExportInAlternatePackage,
			customFileImportRootPrefix
		);
	}

	const alternatePackageAST = parser.parse(alternatePackageCode, {
		sourceType: 'module'
	});

	return traverse(alternatePackageAST, {
		ExportNamedDeclaration: function(path) {
			const exportedVariableNames = path.node.specifiers.map(({ exported: { name } }) => name);			
			const missingExportInAlternatePackage = (typeof importedVariableNames == 'string')?
			([importedVariableNames]) : (importedVariableNames.map((importedVariableName) => {
				if(importedVariableName.indexOf('as') != -1) {
					// remove local name and use orignal export name
					// to verify its exported from the module by removing its
					// alias name
					let arr = importedVariableName.split('as')
					return arr[0] && arr[0].trim();
				} else {
					return importedVariableName
				}
			}).filter(
				importedVariableName => exportedVariableNames.indexOf(importedVariableName) === -1
			));
			return reportErrorAndFix(
				context,
				node,
				matchedRestrictedPackage,
				importedVariableNames,
				isAlternateCustomPackage,
				missingExportInAlternatePackage,
				customFileImportRootPrefix
			);
		}
	});
}

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Restrict Direct Import',
			category: 'AdPushup Errors',
			recommended: true
		},
		fixable: 'code'
	},
	create: function(context) {
		const { alternatePackagesMap, customFileImportRootPrefix } = context.settings[
			'alternate-import'
		];

		return {
			VariableDeclaration(node) {
				node.declarations.map(obj => {
					if (obj.init.type === "CallExpression") {
						// we just need package name and we know it will be always first
						// argument that's how require works. 
						// const package = require('package-name')
						const packageName = obj.init.arguments[0].value

						const matchedRestrictedPackage = alternatePackagesMap.find(
							obj => obj.original === packageName
						);
						if (!matchedRestrictedPackage) return;

						const isAlternateCustomPackage = !!(
							matchedRestrictedPackage.alternate && matchedRestrictedPackage.alternate.match(/.js$/)
						);
		
						// No Alternate Import Provided
						if (!matchedRestrictedPackage.alternate) {
							return context.report({
								node,
								message: `Direct import restricted for "${node.source.value}" package.`
							});
						}

						// Alternate Node Package Import
						if (!isAlternateCustomPackage) {
						} else {
							return context.report({
								node,
								message: `Require restricted for "${packageName}" package, Please use ES6 "import" syntax and use "import from '${
									matchedRestrictedPackage.alternate
								}'"`
							});
						}
					}
				});					
			},
			ImportDeclaration(node) {
				const matchedRestrictedPackage = alternatePackagesMap.find(
					obj => obj.original === node.source.value
				);

				if (!matchedRestrictedPackage) return;

				const isAlternateCustomPackage = !!(
					matchedRestrictedPackage.alternate && matchedRestrictedPackage.alternate.match(/.js$/)
				);

				let importedVariableNames = [];
				let checkItem = node.specifiers[0];
				if(checkItem.type == 'ImportSpecifier') {
					importedVariableNames = node.specifiers.reduce((specifierList, item) => {
						if(item.imported.name != item.local.name) {
							specifierList.push(`${item.imported.name} as ${item.local.name}`)
						} else {
							specifierList.push(item.imported.name)
						}
						return specifierList;
					}, []);
					importedVariableNames = `{ ${importedVariableNames.join(', ')} }`
				} else if(checkItem.type == 'ImportNamespaceSpecifier') {
					importedVariableNames = `* as ${node.specifiers.shift().local.name}`
				} else {
					// for default import specifier
					importedVariableNames = node.specifiers.shift().local.name
				}
				// No Alternate Import Provided
				if (!matchedRestrictedPackage.alternate) {
					return context.report({
						node,
						message: `Direct import restricted for "${node.source.value}" package.`
					});
				}
				// Alternate Node Package Import
				if (!isAlternateCustomPackage) {
					return context.report({
						node,
						message: `Direct import restricted for "${node.source.value}" package.`,
						fix: function(fixer) {
							return fixer.replaceText(
								node,
								`import ${importedVariableNames} from '${
									!isAlternateCustomPackage
										? `${matchedRestrictedPackage.alternate}`
										: `${customFileImportRootPrefix}${matchedRestrictedPackage.alternate.replace(
												/.js$/,
												''
										  )}`
								}';`
							);
						}
					});	
				}

				// Alternate Custom File Import
				return checkCustomFileImport(
					matchedRestrictedPackage,
					context,
					node,
					importedVariableNames,
					isAlternateCustomPackage,
					customFileImportRootPrefix
				);
			}
		};
	}
};
