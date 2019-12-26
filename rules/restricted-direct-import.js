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
				`import { ${importedVariableNames.join(', ')} } from '${
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
			.readFileSync(path.join(__dirname, '..', '..', matchedRestrictedPackage.alternate))
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

			const missingExportInAlternatePackage = importedVariableNames.filter(
				importedVariableName => exportedVariableNames.indexOf(importedVariableName) === -1
			);

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
			ImportDeclaration(node) {
				const matchedRestrictedPackage = alternatePackagesMap.find(
					obj => obj.original === node.source.value
				);

				if (!matchedRestrictedPackage) return;

				const importedVariableNames = node.specifiers.map(({ imported: { name } }) => name);

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
					return reportErrorAndFix(
						context,
						node,
						matchedRestrictedPackage,
						importedVariableNames,
						isAlternateCustomPackage
					);
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
