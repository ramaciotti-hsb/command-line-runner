import React from 'react'
import ReactDOM from 'react-dom'
import { Component } from 'react'
import uuidv4 from 'uuid/v4'
import _ from 'lodash'
import { remote } from 'electron'
const { dialog, Menu, MenuItem } = remote
import sudo from 'electron-sudo'
import path from 'path'
import fs from 'fs'
import ScriptView from './script-view.jsx'
import ScriptEdit from './script-edit.jsx'
import DocumentationView from './documentation-view.jsx'
import DocumentationEdit from './documentation-edit.jsx'
import kill from 'tree-kill'
import shellPath from 'shell-path'
import homePath from 'user-home'
const childProcess = require('child_process')

export default class Container extends Component {

    constructor (props) {
        super(props)
        this.state = {
            collectionTitle: 'New Collection',
            items: []
        }

        const template = [
            {
                label: 'File',
                submenu: [
                    {label: 'New Script Item', accelerator: 'Cmd+N', click: this.newScriptItem.bind(this) },
                    {label: 'New Documentation Item', accelerator: 'Cmd+Shift+D', click: this.newDocumentationItem.bind(this) },
                    {label: 'New Collection', accelerator: 'Cmd+Shift+N'},
                    {label: 'Save Collection', accelerator: 'Cmd+S', click: this.showSaveCollectionAsDialogBox.bind(this) },
                    {label: 'Open Item(s)', accelerator: 'Cmd+Shift+O', click: this.showOpenItemDialog.bind(this) },
                    {label: 'Open Collection(s)',  accelerator: 'Cmd+O', click: this.showOpenCollectionsDialog.bind(this) }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    {role: 'undo'},
                    {role: 'redo'},
                    {type: 'separator'},
                    {role: 'cut'},
                    {role: 'copy'},
                    {role: 'paste'},
                    {role: 'pasteandmatchstyle'},
                    {role: 'delete'},
                    {role: 'selectall'}
                ]
            },
            {
                label: 'View',
                submenu: [
                    {role: 'reload'},
                    {role: 'forcereload'},
                    {role: 'toggledevtools'},
                    {type: 'separator'},
                    {role: 'resetzoom'},
                    {role: 'zoomin'},
                    {role: 'zoomout'},
                    {type: 'separator'},
                    {role: 'togglefullscreen'}
                ]
            },
            {
                role: 'window',
                submenu: [
                    {role: 'minimize'},
                    {role: 'close'}
                ]
            },
            {
                role: 'help',
                submenu: [
                    {
                        label: 'Learn More'
                    }
                ]
            }
        ]

        if (process.platform === 'darwin') {
            template.unshift({
                label: remote.app.getName(),
                submenu: [
                    {role: 'about'},
                    {type: 'separator'},
                    {role: 'services', submenu: []},
                    {type: 'separator'},
                    {role: 'hide'},
                    {role: 'hideothers'},
                    {role: 'unhide'},
                    {type: 'separator'},
                    {role: 'quit'}
                ]
            })

            // Edit menu
            template[2].submenu.push(
                {type: 'separator'},
                {
                    label: 'Speech',
                    submenu: [
                        {role: 'startspeaking'},
                        {role: 'stopspeaking'}
                    ]
                }
            )

            // Windows menu
            template[4].submenu = [
                {role: 'close'},
                {role: 'minimize'},
                {role: 'zoom'},
                {type: 'separator'},
                {role: 'front'}
            ]
        }

        // Create the file menu with open, etc
        const menu = Menu.buildFromTemplate(template)
        Menu.setApplicationMenu(menu)

        // Load the collections and items the user last had open when the app was used
        const sessionFilePath = path.join(remote.app.getPath('userData'), 'session.json')
        try {
            const session = JSON.parse(fs.readFileSync(sessionFilePath))
            for (let item of session.items) {
                if (item.running) {
                    item.running = false
                    item.status = 'error'
                }
            }
            this.state = _.merge(this.state, session)
        } catch (error) {
            // If there's no session file, create one
            if (error.code === 'ENOENT') {
                fs.writeFile(sessionFilePath, JSON.stringify(this.state), () => {})
            } else {
                console.log(error)
            }
        }
    }

    saveSessionState () {
        const sessionFilePath = path.join(remote.app.getPath('userData'), 'session.json')
        // Prevent runtime state information such as running commands and stdout from being saved to the collection file
        for (let item of this.state.items) {
            item.toJSON = function () {
                return _.omit(this, [ 'runningCommand' ])
            };
        }
        fs.writeFile(sessionFilePath, JSON.stringify(this.state, null, 4), () => {})
    }

    newScriptItem () {
        const newId = uuidv4()
        this.state.items.push({
            id: newId,
            type: "script",
            title: "New Item",
            description: "",
            workingDirectory: "",
            command: [],
            parameters: [],
            editing: true,
            outputFile: {
                type: 'none'
            }
        })
        this.setState({
            items: this.state.items,
            selectedItemId: newId
        })
        this.saveSessionState()
    }

    newDocumentationItem () {
        const newId = uuidv4()
        this.state.items.push({
            id: newId,
            type: "documentation",
            title: "New Documentation Item",
            editing: true,
            body: "",
        })
        this.setState({
            items: this.state.items,
            selectedItemId: newId
        })
        this.saveSessionState()
    }

    deleteItem (itemId) {
        let itemIndex = _.findIndex(this.state.items, (item) => {
            return item.id === itemId
        })

        if (itemIndex === -1) { return }
        this.state.items.splice(itemIndex, 1)
        if (itemIndex === this.state.items.length) {
            itemIndex--
        }
        this.setState({
            items: this.state.items,
            selectedItemId: this.state.items[itemIndex].id
        })
        this.saveSessionState()
    }

    openItemFiles (paths) {
        const toReturn = []
        // Let the user open a saved template of a item or collection file
        if (paths) {
            // Loop through if multiple files were selected
            for (let path of paths) {
                const item = JSON.parse(fs.readFileSync(path))
                item.path = path
                toReturn.push(item)
            }
        }
        return toReturn
    }

    openCollectionFiles (paths) {
        const toReturn = []
        if (paths) {
            // Loop through if multiple files were selected
            for (let path of paths) {
                const collection = JSON.parse(fs.readFileSync(path))
                collection.path = path
                toReturn.push(collection)
            }
        }
        return toReturn
    }

    exportItemToFile (itemId) {
        const item = _.find(this.state.items, item => item.id === itemId)

        if (!item) { return }

        dialog.showSaveDialog({ title: `Save ${item.title}`, defaultPath: (item.workingDirectory ? item.workingDirectory.replace('\\', '') : homePath) + item.title.replace(/\ /g, '-').toLowerCase() + '.json', message: `Save ${item.title}` }, (path) => {
            if (path) {
                fs.writeFile(path, JSON.stringify(item, null, 4), function(err) {
                    if(err) {
                        return console.log(err);
                    }

                    console.log("The file was saved!");
                });
            }
        })
    }

    showSaveCollectionAsDialogBox () {
        dialog.showSaveDialog({ title: `Save Collection As:`, message: `Save Collection As:`, defaultPath: this.state.collectionTitle.replace(/\ /g, '-').toLowerCase() + '.json' }, (path) => {
            if (path) {
                // Prevent runtime state information such as running commands and stdout from being saved to the collection file
                for (let item of this.state.items) {
                    item.toJSON = function () {
                        return _.omit(this, [ 'path', 'runningCommand', 'running', 'error', 'output', 'status', 'stdinInputValue'])
                    };
                }
                fs.writeFile(path, JSON.stringify(this.state, null, 4), function(err) {
                    if(err) {
                        return console.log(err);
                    }

                    console.log("The file was saved!");
                });
            }
        })
    }

    showOpenCollectionsDialog () {
        dialog.showOpenDialog({ title: `Open Collection File`, filters: [{ name: 'CLR collection templates', extensions: ['json']}], message: `Open Collection File`, properties: ['openFile'] }, (paths) => {
            const collection = this.openCollectionFiles(paths)[0]
            this.setState(collection, () => {
                // Save the session state after opening new files
                this.saveSessionState()
            })
        })
    }

    showOpenItemDialog () {
        dialog.showOpenDialog({ title: `Open Item File`, filters: [{ name: 'CLR item templates', extensions: ['json']}], message: `Open Item File`, properties: ['openFile', 'multiSelections'] }, (paths) => {
            const items = this.openItemFiles(paths)
            this.setState({
                items: this.state.items.concat(items)
            }, () => {
                // Save the session state after opening new files
                this.saveSessionState()
            })
        })
    }

    // Select a file from the filesystem and use it for a parameter value (e.g file input parameter)
    openFileForParameterDialog (parameterId, dialogOptions) {
        // Find the parameter
        let parameter
        let item
        for (let i of this.state.items) {
            parameter = _.find(i.parameters, { id: parameterId })
            if (parameter) {
                item = i
                break
            }
        }
        console.log(parameter)
        if (!parameter) { return }
        if (!item) { return }

        dialog.showOpenDialog({ title: `Select ${parameter.parameter}`, defaultPath: (item.workingDirectory ? item.workingDirectory.replace('\\', '') : homePath), message: `Select ${parameter.parameter}`, properties: dialogOptions }, (path) => {
            if (path) {
                parameter.value = path[0]
                this.setState({
                    items: this.state.items
                })
            }
        })
    }

    // Select a file from the filesystem and use it for a item attribute (working directory, etc)
    openFileForItemDialog (itemId, key, dialogOptions) {
        const item = _.find(this.state.items, (item) => {
            return item.id === itemId
        })

        if (!item) { return }

        dialog.showOpenDialog({ title: `Select ${key}`, defaultPath: (item.workingDirectory ? item.workingDirectory.replace('\\', '') : homePath), message: `Select ${key}`, properties: dialogOptions }, (path) => {
            if (path) {
                item[key] = path[0]
                this.setState({
                    items: this.state.items
                })
            }
        })
    }

    // Run a command line utility, command is input as an array of arguments
    runCommand (itemId) {
        const item = _.find(this.state.items, (item) => {
            return item.id === itemId
        })

        if (!item) { return }

        const commandArray = [].concat(item.command)
        // Add any defined parameters to the command
        item.parameters.map((parameter) => {
            if (parameter.value) {
                commandArray.push(parameter.parameter)
                commandArray.push(parameter.value)
            }
        })

        item.running = true
        item.output = commandArray.join(' ') + "\n\n"
        if (item.sudo) {
            this.runCommandSudo(item, commandArray)
            return
        }

        const commandArguments = commandArray.slice(1).map(c => c.replace(/\ /g, '\\ '))
        item.runningCommand = childProcess.spawn(commandArray[0], commandArguments, { cwd: (item.workingDirectory ? item.workingDirectory.replace('\\', '') : homePath), shell: true })

        // Catch spawn errors
        item.runningCommand.on('error', (error) => {
            if (error.code === 'ENOENT') {
                writeStdout(`Error: ${commandArray[0]} was not found. Perhaps it is not installed?`)
            } else {
                console.log(error)
            }
        })

        this.setState({
            items: this.state.items
        })

        let writeStdout = (data) => {
            item.output += data + "\n"
            // Limit the output buffer to 1000 characters
            if (item.output.length > 20000) {
                item.output = item.output.substring(item.output.length - 20000)
            }
            this.setState({
                items: this.state.items
            }, () => {
                // Scroll output container to bottom
                this.refs.itemView.scrollOutputToBottom()
            })
        }

        item.runningCommand.stdout.on('data', writeStdout);
        item.runningCommand.stderr.on('data', writeStdout);

        item.runningCommand.on( 'close', code => {
            item.running = false
            item.status = code !== 0 ? 'error' : 'success'
            this.setState({
                items: this.state.items
            }, () => {
                this.saveSessionState()
            })
        });
        this.saveSessionState()
    }

    // Run a command using sudo
    runCommandSudo (item, commandArray) {
        let spawner = new sudo()
        spawner.spawn(commandArray[0], commandArray.slice(1), { cwd: (item.workingDirectory ? item.workingDirectory.replace('\\', '') : homePath), env: { 'PATH': shellPath.sync(), 'HOME': homePath } }).then((cp) => {
            item.output += 'Running a command as root / administrator, no output will be available until it\'s finished.\n'
            this.setState({
                items: this.state.items
            })

            cp.on('close', (code) => {
                item.output += cp.output.stdout.toString()
                item.output += cp.output.stderr.toString()
                this.refs.itemView.scrollOutputToBottom()
                item.running = false
                item.status = code !== 0 ? 'error' : 'success'
                this.setState({
                    items: this.state.items
                }, () => {
                    this.saveSessionState()
                })
            })
        })
    }

    // Kills a running item
    killCommand (itemId) {
        const item = _.find(this.state.items, (item) => {
            return item.id === itemId
        })

        if (!item) { return }
        
        if (item.runningCommand && item.runningCommand.pid) {
            kill(item.runningCommand.pid);
        }
    }

    selectItem (itemId) {
        this.setState({
            selectedItemId: itemId
        }, () => { this.saveSessionState() })
    }

    toggleEditModeForItem (itemId) {
        const item = _.find(this.state.items, item => item.id === itemId)
        if (item) {
            item.editing = !item.editing
            this.setState({
                items: this.state.items
            })
        }
        this.saveSessionState()
    }

    saveEditing (itemId) {
        const item = _.find(this.state.items, item => item.id === itemId)
        if (item) {
            this.toggleEditModeForItem(itemId)
        }
    }

    cancelEditing (itemId) {
        const item = _.find(this.state.items, item => item.id === itemId)
        if (item) {
            this.toggleEditModeForItem(itemId)
        }
    }

    // Updates a property of a item
    updateItem (itemId, key, value) {
        const item = _.find(this.state.items, (item) => {
            return item.id === itemId
        })

        if (!item) { return }

        item[key] = value
        this.setState({
            items: this.state.items
        })
    }

    // Updates a property of a parameter
    updateParameter (parameterId, key, value) {
        let parameter
        for (let item of this.state.items) {
            parameter = _.find(item.parameters, { id: parameterId })
            if (parameter) { break }
        }
        if (!parameter) { return }

        parameter[key] = value
        this.setState({
            items: this.state.items
        })
    }

    addParameter (itemId) {
        const item = _.find(this.state.items, (item) => {
            return item.id === itemId
        })

        if (!item) { return }

        item.parameters.push({
            id: uuidv4(),
            parameter: '',
            type: 'text',
            value: ''
        })

        this.setState({
            items: this.state.items
        })
    }

    deleteParameter (parameterId) {
        let parameterIndex
        let item
        for (let item of this.state.items) {
            parameterIndex = _.findIndex(item.parameters, { id: parameterId })
            if (parameterIndex > 0) {
                item = item
                break
            }
        }
        if (!parameterIndex) { return }

        item.parameters.splice(parameterIndex, 1)
        this.setState({
            items: this.state.items
        })
    }

    handleDroppableInputChange (parameterId, event) {
        let parameter
        for (let item of this.state.items) {
            parameter = _.find(item.parameters, { id: parameterId })
            if (parameter) { break }
        }

        if (event.type === 'change') {
            parameter.value = event.target.value
        } else if (event.type === 'drop') {
            parameter.value = event.dataTransfer.files[0].path
        }
        this.setState({
            items: this.state.items
        })
        event.preventDefault()
    }

    handleStdinInputChange(itemId, event) {
        const item = _.find(this.state.items, item => item.id === itemId)

        if (!item) { return }

        item.stdinInputValue = event.target.value

        this.setState({
            items: this.state.items
        })
    }

    handleStdinKeyPress (itemId, event) {
        const item = _.find(this.state.items, item => item.id === itemId)

        if (!item) { return }

        if (event.key === 'Enter') {
            if (item.runningCommand) {
                item.runningCommand.stdin.write(item.stdinInputValue + '\n')
                item.output += item.stdinInputValue + '\n'
                item.stdinInputValue = ''
                this.setState({
                    items: this.state.items
                })
            }
        }
    }

    render () {
        const collectionsItemsRendered = this.state.items.map((item, index) => {
            return (
                <div className={'sidebar-item' + (item.id === this.state.selectedItemId ? ' selected' : '')} key={index} onClick={this.selectItem.bind(this, item.id)}>
                    <div className='number'>#{index + 1}</div>
                    <div className='body'>
                        <div className='title'>{item.title}</div>
                        <div className='description'>{item.description}</div>
                    </div>
                </div>
            )
        })

        const item = _.find(this.state.items, (item) => {
            return item.id === this.state.selectedItemId
        })

        let panel = <div className='panel'></div>

        if (item) {
            if (item.type === 'script') {
                if (!item.editing) {
                    panel = <ScriptView ref={'itemView'} {...item}
                        handleDroppableInputChange={this.handleDroppableInputChange.bind(this)}
                        handleStdinKeyPress={this.handleStdinKeyPress.bind(this, item.id)}
                        handleStdinInputChange={this.handleStdinInputChange.bind(this, item.id)}
                        openFileForParameterDialog={this.openFileForParameterDialog.bind(this)}
                        runCommand={this.runCommand.bind(this, item.id)}
                        toggleEditModeForItem={this.toggleEditModeForItem.bind(this, item.id)}
                        exportItemToFile={this.exportItemToFile.bind(this, item.id)}
                        killCommand={this.killCommand.bind(this, item.id)}
                        deleteItem={this.deleteItem.bind(this, item.id)}
                    />
                } else if (item.editing) {
                    panel = <ScriptEdit ref={'itemEdit'} {...item}
                        updateParameter={this.updateParameter.bind(this)}
                        updateItem={this.updateItem.bind(this, item.id)}
                        saveEditing={this.saveEditing.bind(this)}
                        cancelEditing={this.cancelEditing.bind(this)}
                        addParameter={this.addParameter.bind(this)}
                        deleteParameter={this.deleteParameter.bind(this)}
                        openFileForItemDialog={this.openFileForItemDialog.bind(this)}
                    />
                }
            } else if (item.type === 'documentation') {
                if (!item.editing) {
                    panel = <DocumentationView ref={'itemView'} {...item}
                        toggleEditModeForItem={this.toggleEditModeForItem.bind(this, item.id)}
                        exportItemToFile={this.exportItemToFile.bind(this, item.id)}
                        deleteItem={this.deleteItem.bind(this, item.id)}
                    />
                } else {
                    panel = <DocumentationEdit ref={'itemEdit'} {...item}
                        saveEditing={this.saveEditing.bind(this)}
                        cancelEditing={this.cancelEditing.bind(this)}
                        updateItem={this.updateItem.bind(this, item.id)}
                    />
                }
            }
        }

        const collectionTabs = [<div className='tab' key={1}>{this.state.collectionTitle}</div>]

        return (
            <div className='container'>
                <div className='tab-bar'>
                    {collectionTabs}
                </div>
                <div className='container-inner'>
                    <div className='sidebar'>
                        {collectionsItemsRendered}
                    </div>
                    {panel}
                </div>
            </div>
        )
    }
}