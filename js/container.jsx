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
import kill from 'tree-kill'
const childProcess = require('child_process')

export default class Container extends Component {

    constructor (props) {
        super(props)
        this.state = {
            collectionTitle: 'New Collection',
            scripts: []
        }

        const template = [
            {
                label: 'File',
                submenu: [
                    {label: 'New Script', accelerator: 'Cmd+N', click: this.newScript.bind(this) },
                    {label: 'New Collection', accelerator: 'Cmd+Shift+N'},
                    {label: 'Save Collection', accelerator: 'Cmd+S', click: this.showSaveCollectionAsDialogBox.bind(this) },
                    {label: 'Open Script(s)', accelerator: 'Cmd+Shift+O', click: this.showOpenScriptDialog.bind(this) },
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

        // Load the collections and scripts the user last had open when the app was used
        const sessionFilePath = path.join(remote.app.getPath('userData'), 'session.json')
        try {
            const session = JSON.parse(fs.readFileSync(sessionFilePath))
            for (let script of session.scripts) {
                if (script.running) {
                    script.running = false
                    script.status = 'error'
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
        for (let script of this.state.scripts) {
            script.toJSON = function () {
                return _.omit(this, [ 'runningCommand' ])
            };
        }
        fs.writeFile(sessionFilePath, JSON.stringify(this.state, null, 4), () => {})
    }

    newScript () {
        const newId = uuidv4()
        this.state.scripts.push({
            "id": newId,
            "title": "New Script",
            "description": "",
            "workingDirectory": "",
            "command": [],
            "parameters": [],
            editing: true,
            outputFile: {
                type: 'none'
            }
        })
        this.setState({
            scripts: this.state.scripts,
            selectedScriptId: newId
        })
        this.saveSessionState()
    }

    openScriptFiles (paths) {
        const toReturn = []
        // Let the user open a saved template of a script or collection file
        if (paths) {
            // Loop through if multiple files were selected
            for (let path of paths) {
                const script = JSON.parse(fs.readFileSync(path))
                script.path = path
                toReturn.push(script)
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

    exportScriptToFile (scriptId) {
        const script = _.find(this.state.scripts, item => item.id === scriptId)

        if (!script) { return }

        dialog.showSaveDialog({ title: `Save ${script.title}`, defaultPath: script.workingDirectory.replace('\\', '') + script.title.replace(/\ /g, '-').toLowerCase() + '.json', message: `Save ${script.title}` }, (path) => {
            if (path) {
                fs.writeFile(path, JSON.stringify(script, null, 4), function(err) {
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
                for (let script of this.state.scripts) {
                    script.toJSON = function () {
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

    showOpenScriptDialog () {
        dialog.showOpenDialog({ title: `Open Script File`, filters: [{ name: 'CLR script templates', extensions: ['json']}], message: `Open Script File`, properties: ['openFile', 'multiSelections'] }, (paths) => {
            const scripts = this.openScriptFiles(paths)
            this.setState({
                scripts: this.state.scripts.concat(scripts)
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
        let script
        for (let item of this.state.scripts) {
            parameter = _.find(item.parameters, { id: parameterId })
            if (parameter) {
                script = item
                break
            }
        }
        if (!parameter) { return }

        dialog.showOpenDialog({ title: `Select ${parameter.parameter}`, defaultPath: script.workingDirectory.replace('\\', ''), message: `Select ${parameter.parameter}`, properties: dialogOptions }, (path) => {
            if (path) {
                parameter.value = path[0]
                this.setState({
                    scripts: this.state.scripts
                })
            }
        })
    }

    // Select a file from the filesystem and use it for a script attribute (working directory, etc)
    openFileForScriptDialog (scriptId, key, dialogOptions) {
        const script = _.find(this.state.scripts, (item) => {
            return item.id === scriptId
        })

        if (!script) { return }

        dialog.showOpenDialog({ title: `Select ${key}`, defaultPath: script.workingDirectory.replace('\\', ''), message: `Select ${key}`, properties: dialogOptions }, (path) => {
            if (path) {
                script[key] = path[0]
                this.setState({
                    scripts: this.state.scripts
                })
            }
        })
    }

    // Run a command line utility, command is input as an array of arguments
    runCommand (scriptId) {
        const script = _.find(this.state.scripts, (item) => {
            return item.id === scriptId
        })

        if (!script) { return }

        const commandArray = [].concat(script.command)
        // Add any defined parameters to the command
        script.parameters.map((parameter) => {
            if (parameter.value) {
                commandArray.push(parameter.parameter)
                commandArray.push(parameter.value)
            }
        })

        script.running = true
        script.output = commandArray.join(' ') + "\n\n"
        if (script.sudo) {
            this.runCommandSudo(script, commandArray)
            return
        }

        script.runningCommand = childProcess.spawn(commandArray[0], commandArray.slice(1), { cwd: script.workingDirectory })

        // Catch spawn errors
        script.runningCommand.on('error', (error) => {
            if (error.code === 'ENOENT') {
                writeStdout(`Error: ${commandArray[0]} was not found. Perhaps it is not installed?`)
            } else {
                console.log(error)
            }
        })

        this.setState({
            scripts: this.state.scripts
        })

        let writeStdout = (data) => {
            script.output += data + "\n"
            // Limit the output buffer to 1000 characters
            if (script.output.length > 20000) {
                script.output = script.output.substring(script.output.length - 20000)
            }
            this.setState({
                scripts: this.state.scripts
            }, () => {
                // Scroll output container to bottom
                this.refs.scriptView.scrollOutputToBottom()
            })
        }

        script.runningCommand.stdout.on('data', writeStdout);
        script.runningCommand.stderr.on('data', writeStdout);

        script.runningCommand.on( 'close', code => {
            script.running = false
            script.status = code !== 0 ? 'error' : 'success'
            this.setState({
                scripts: this.state.scripts
            }, () => {
                this.saveSessionState()
            })
        });
        this.saveSessionState()
    }

    // Run a command using sudo
    runCommandSudo (script, commandArray) {
        let spawner = new sudo()
        spawner.spawn(commandArray[0], commandArray.slice(1), { cwd: script.workingDirectory }).then((cp) => {
            script.output += 'Running a command as root / administrator, no output will be available until it\'s finished.\n'
            this.setState({
                scripts: this.state.scripts
            })

            cp.on('close', (code) => {
                script.output += cp.output.stdout.toString()
                script.output += cp.output.stderr.toString()
                this.refs.scriptView.scrollOutputToBottom()
                script.running = false
                script.status = code !== 0 ? 'error' : 'success'
                this.setState({
                    scripts: this.state.scripts
                }, () => {
                    this.saveSessionState()
                })
            })
        })
    }

    // Kills a running script
    killCommand (scriptId) {
        const script = _.find(this.state.scripts, (item) => {
            return item.id === scriptId
        })

        if (!script) { return }
        
        if (script.runningCommand && script.runningCommand.pid) {
            kill(script.runningCommand.pid);
        }
    }

    selectScript (scriptId) {
        this.setState({
            selectedScriptId: scriptId
        }, () => { this.saveSessionState() })
    }

    toggleEditModeForScript (scriptId) {
        const script = _.find(this.state.scripts, item => item.id === scriptId)
        if (script) {
            script.editing = !script.editing
            this.setState({
                scripts: this.state.scripts
            })
        }
        this.saveSessionState()
    }

    saveEditing (scriptId) {
        const script = _.find(this.state.scripts, item => item.id === scriptId)
        if (script) {
            this.toggleEditModeForScript(scriptId)
        }
    }

    cancelEditing (scriptId) {
        const script = _.find(this.state.scripts, item => item.id === scriptId)
        if (script) {
            this.toggleEditModeForScript(scriptId)
        }
    }

    // Updates a property of a script
    updateScript (scriptId, key, value) {
        const script = _.find(this.state.scripts, (item) => {
            return item.id === scriptId
        })

        if (!script) { return }

        script[key] = value
        this.setState({
            scripts: this.state.scripts
        })
    }

    // Updates a property of a parameter
    updateParameter (parameterId, key, value) {
        let parameter
        for (let item of this.state.scripts) {
            parameter = _.find(item.parameters, { id: parameterId })
            if (parameter) { break }
        }
        if (!parameter) { return }

        parameter[key] = value
        this.setState({
            scripts: this.state.scripts
        })
    }

    addParameter (scriptId) {
        const script = _.find(this.state.scripts, (item) => {
            return item.id === scriptId
        })

        if (!script) { return }

        script.parameters.push({
            id: uuidv4(),
            parameter: '',
            type: 'text',
            value: ''
        })

        this.setState({
            scripts: this.state.scripts
        })
    }

    deleteParameter (parameterId) {
        let parameterIndex
        let script
        for (let item of this.state.scripts) {
            parameterIndex = _.findIndex(item.parameters, { id: parameterId })
            if (parameterIndex > 0) {
                script = item
                break
            }
        }
        if (!parameterIndex) { return }

        script.parameters.splice(parameterIndex, 1)
        this.setState({
            scripts: this.state.scripts
        })
    }

    handleDroppableInputChange (parameterId, event) {
        let parameter
        for (let item of this.state.scripts) {
            parameter = _.find(item.parameters, { id: parameterId })
            if (parameter) { break }
        }

        if (event.type === 'change') {
            parameter.value = event.target.value
        } else if (event.type === 'drop') {
            parameter.value = event.dataTransfer.files[0].path
        }
        this.setState({
            scripts: this.state.scripts
        })
        event.preventDefault()
    }

    handleStdinInputChange(scriptId, event) {
        const script = _.find(this.state.scripts, item => item.id === scriptId)

        if (!script) { return }

        script.stdinInputValue = event.target.value

        this.setState({
            scripts: this.state.scripts
        })
    }

    handleStdinKeyPress (scriptId, event) {
        const script = _.find(this.state.scripts, item => item.id === scriptId)

        if (!script) { return }

        if (event.key === 'Enter') {
            if (script.runningCommand) {
                script.runningCommand.stdin.write(script.stdinInputValue + '\n')
                script.output += script.stdinInputValue + '\n'
                script.stdinInputValue = ''
                this.setState({
                    scripts: this.state.scripts
                })
            }
        }
    }

    render () {
        const collectionsItemsRendered = this.state.scripts.map((item, index) => {
            return (
                <div className={'sidebar-item' + (item.id === this.state.selectedScriptId ? ' selected' : '')} key={index} onClick={this.selectScript.bind(this, item.id)}>
                    <div className='number'>#{index + 1}</div>
                    <div className='body'>
                        <div className='title'>{item.title}</div>
                        <div className='description'>{item.description}</div>
                    </div>
                </div>
            )
        })

        const script = _.find(this.state.scripts, (item) => {
            return item.id === this.state.selectedScriptId
        })

        let panel = <div className='panel'></div>

        if (script && !script.editing) {
            panel = <ScriptView ref={'scriptView'} {...script}
                handleDroppableInputChange={this.handleDroppableInputChange.bind(this)}
                handleStdinKeyPress={this.handleStdinKeyPress.bind(this)}
                handleStdinInputChange={this.handleStdinInputChange.bind(this)}
                openFileForParameterDialog={this.openFileForParameterDialog.bind(this)}
                runCommand={this.runCommand.bind(this)}
                toggleEditModeForScript={this.toggleEditModeForScript.bind(this)}
                exportScriptToFile={this.exportScriptToFile.bind(this)}
                killCommand={this.killCommand.bind(this)}
            />
        } else if (script && script.editing) {
            panel = <ScriptEdit ref={'scriptEdit'} {...script}
                updateParameter={this.updateParameter.bind(this)}
                updateScript={this.updateScript.bind(this)}
                saveEditing={this.saveEditing.bind(this)}
                cancelEditing={this.cancelEditing.bind(this)}
                addParameter={this.addParameter.bind(this)}
                deleteParameter={this.deleteParameter.bind(this)}
                openFileForScriptDialog={this.openFileForScriptDialog.bind(this)}
            />
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